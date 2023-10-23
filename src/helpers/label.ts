import Runtime from "../bindings/bot-runtime";
import { Label, Payload, Context } from "../types";
import { deleteLabel } from "./issue";
import { calculateLabelValue } from "../helpers";
import { calculateTaskPrice } from "../handlers/shared/pricing";

// cspell:disable
const COLORS = {
  default: "ededed",
  price: "1f883d",
};
// cspell:enable

export async function listLabelsForRepo(context: Context): Promise<Label[]> {
  const payload = context.event.payload as Payload;

  const res = await context.event.octokit.rest.issues.listLabelsForRepo({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    per_page: 100,
    page: 1,
  });

  if (res.status === 200) {
    return res.data;
  }

  throw new Error(`Failed to fetch lists of labels, code: ${res.status}`);
}

export async function createLabel(context: Context, name: string, labelType?: keyof typeof COLORS): Promise<void> {
  const runtime = Runtime.getState();
  const logger = runtime.logger;
  // console.trace("createLabel", { name, labelType });
  const payload = context.event.payload as Payload;
  try {
    await context.event.octokit.rest.issues.createLabel({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      name,
      color: COLORS[labelType ?? "default"],
    });
  } catch (err: unknown) {
    logger.debug("Error creating a label: ", err);
  }
}

export async function getLabel(context: Context, name: string): Promise<boolean> {
  const runtime = Runtime.getState();
  const logger = runtime.logger;
  const payload = context.event.payload as Payload;
  try {
    const res = await context.event.octokit.rest.issues.getLabel({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      name,
    });
    return res.status === 200 ? true : false;
  } catch (err: unknown) {
    logger.debug("Error getting a label: ", err);
  }

  return false;
}

// Function to update labels based on the base rate difference
export async function updateLabelsFromBaseRate(
  context: Context,
  owner: string,
  repo: string,
  labels: Label[],
  previousBaseRate: number
) {
  const runtime = Runtime.getState();
  const logger = runtime.logger;
  const config = context.config;

  const newLabels: string[] = [];
  const previousLabels: string[] = [];

  for (const timeLabel of config.price.timeLabels) {
    for (const priorityLabel of config.price.priorityLabels) {
      const targetPrice = calculateTaskPrice(
        context,
        calculateLabelValue(timeLabel),
        calculateLabelValue(priorityLabel),
        config.price.priceMultiplier
      );
      const targetPriceLabel = `Price: ${targetPrice} USD`;
      newLabels.push(targetPriceLabel);

      const previousTargetPrice = calculateTaskPrice(
        context,
        calculateLabelValue(timeLabel),
        calculateLabelValue(priorityLabel),
        previousBaseRate
      );
      const previousTargetPriceLabel = `Price: ${previousTargetPrice} USD`;
      previousLabels.push(previousTargetPriceLabel);
    }
  }

  const uniqueNewLabels = [...new Set(newLabels)];
  const uniquePreviousLabels = [...new Set(previousLabels)];

  const labelsFiltered: string[] = labels.map((obj) => obj["name"]);
  const usedLabels = uniquePreviousLabels.filter((value: string) => labelsFiltered.includes(value));

  logger.debug("Got used labels: ", { usedLabels });

  try {
    for (const label of usedLabels) {
      if (label.startsWith("Price: ")) {
        const labelData = labels.find((obj) => obj["name"] === label) as Label;
        const index = uniquePreviousLabels.findIndex((obj) => obj === label);

        const exist = await getLabel(context, uniqueNewLabels[index]);
        if (exist) {
          // we have to delete first
          logger.debug("Label already exists, deleting it", { label });
          await deleteLabel(context, uniqueNewLabels[index]);
        }

        // we can update safely
        await context.event.octokit.issues.updateLabel({
          owner,
          repo,
          name: label,
          new_name: uniqueNewLabels[index],
          color: labelData.color,
          description: labelData.description,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });

        logger.debug("Label updated", { label, to: uniqueNewLabels[index] });
      }
    }
  } catch (error: unknown) {
    logger.error("Error updating labels", { error });
  }
}
