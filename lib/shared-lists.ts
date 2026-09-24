/**
 * Word lists are shared between the children; progress is not.
 *
 * Each child's database holds its own copy of every list, under the same _id,
 * so each copy can carry that child's progress (srs, skills, path, reading).
 * After any change to a list's words or meanings, syncList() copies the
 * content from the child who made it to every other child, keeping their
 * progress on the words they already have. A list gone from the source is
 * deleted everywhere.
 *
 * Server-only: touches Mongoose.
 */

import { learnerModels } from "@/lib/db";
import { LEARNER_IDS, ownerOf, type LearnerId } from "@/lib/learners";
import { listContent, wordContent } from "@/lib/models/WordList";

export async function syncList(from: LearnerId, listId: string): Promise<void> {
  const source = await (await learnerModels(from)).WordList.findById(listId).lean();
  if (source?.kind === "pool") return; // Stuck words belong to one child.
  for (const other of LEARNER_IDS) {
    if (other === from) continue;
    const { WordList } = await learnerModels(other);
    if (!source) {
      await WordList.deleteOne({ _id: listId });
      continue;
    }
    const content = listContent(source);
    const exists = await WordList.exists({ _id: listId });
    if (!exists) {
      await WordList.create({ _id: listId, ...content });
      continue;
    }
    // Word by word, so the other child's progress on each word is untouched.
    // Empty meanings never overwrite filled ones: the other copy may have
    // been given its Arabic or examples first.
    const ops = content.words.flatMap((w) => {
      const set: Record<string, unknown> = { "words.$.clue": w.clue };
      if (w.arabic) set["words.$.arabic"] = w.arabic;
      if (w.explanation) set["words.$.explanation"] = w.explanation;
      if (w.examples.length > 0) set["words.$.examples"] = w.examples;
      if (w.family.length > 0) set["words.$.family"] = w.family;
      return [
        { updateOne: { filter: { _id: listId, "words.word": w.word }, update: { $set: set } } },
        {
          updateOne: {
            filter: { _id: listId, "words.word": { $ne: w.word } },
            update: { $push: { words: wordContent(w) } },
          },
        },
      ];
    });
    ops.push({
      updateOne: {
        filter: { _id: listId },
        update: {
          $set: { name: content.name, hiddenMessage: content.hiddenMessage },
          $pull: { words: { word: { $nin: content.words.map((w) => w.word) } } },
        },
      },
    } as never);
    await WordList.bulkWrite(ops as never, { ordered: true });
  }
}

/** True when this child added the list, so may delete it. */
export function mayDelete(learner: LearnerId, list: { addedBy?: unknown }): boolean {
  return ownerOf(list.addedBy) === learner;
}
