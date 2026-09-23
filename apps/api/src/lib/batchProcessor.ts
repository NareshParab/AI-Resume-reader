import { getDatabase } from "./db.js";
import { parseResumeText } from "./parser.js";
import { scoreCandidate } from "./candidateScoring.js";
import { withRetry } from "./withRetry.js";
import { ObjectId } from "mongodb";
import type { Resume, Batch } from "@gcarbon/types";

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function processBatch(batchId: string): Promise<void> {
  try {
    const db = getDatabase();
    const batchesCollection = db.collection<Omit<Batch, "_id">>("batches");
    const resumesCollection = db.collection<Omit<Resume, "_id">>("resumes");

    const batchObjectId = new ObjectId(batchId);
    
    // Fetch the batch to get jobDescription
    const batch = await batchesCollection.findOne({ _id: batchObjectId });
    if (!batch) {
      console.error(`[BatchProcessor] Batch ${batchId} not found.`);
      return;
    }

    // Fetch all resumes for this batch
    const resumes = await resumesCollection.find({ batchId }).toArray();
    
    let completedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < resumes.length; i++) {
      const resume = resumes[i];
      if (!resume) continue;

      try {
        if (i > 0) {
          // Wait 4 seconds between each resume's AI call
          await delay(4000);
        }

        const parsedProfile = parseResumeText(resume.extractedText);
        const candidateScore = await withRetry(() =>
          scoreCandidate(parsedProfile, batch.jobDescription)
        );

        await resumesCollection.updateOne(
          { _id: resume._id },
          { 
            $set: { 
              parsedProfile, 
              candidateScore 
            } 
          }
        );

        completedCount++;
        
        // Update batch counts live
        await batchesCollection.updateOne(
          { _id: batchObjectId },
          { $set: { completedCount } }
        );

      } catch (err) {
        console.error(`[BatchProcessor] Failed to process resume ${resume._id.toString()}:`, err);
        failedCount++;
        
        // Update batch counts live
        await batchesCollection.updateOne(
          { _id: batchObjectId },
          { $set: { failedCount } }
        );
      }
    }

    // Update batch to completed
    await batchesCollection.updateOne(
      { _id: batchObjectId },
      { 
        $set: { 
          status: "completed",
          completedCount,
          failedCount
        } 
      }
    );

    console.log(`[BatchProcessor] Batch ${batchId} completed. ${completedCount.toString()} success, ${failedCount.toString()} failed.`);

  } catch (error) {
    console.error(`[BatchProcessor] Fatal error processing batch ${batchId}:`, error);
  }
}
