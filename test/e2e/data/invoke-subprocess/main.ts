// main.ts
import fs from 'fs';
import path from 'path';
import { extract } from 'zip-lib';

export default class PostmanCollectionImporter {
    public resumingStates: {
        processedItems: string[]; // Track processed item IDs
    } = {
        processedItems: [],
    };

    private readonly batchSize = 10; // Process 10 items in parallel per batch

    constructor() {}

    public async execute(): Promise<void> {
        const listFilePath = path.join('./upload', 'list.json');
        const zipFilePath = path.join('./upload', 'downloads.zip');
        const tmpDir = path.join('./tmp');

        // Ensure tmp directory exists
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Load list.json
        const listData = JSON.parse(fs.readFileSync(listFilePath, 'utf-8'));

        // Unzip downloads.zip if not already done
        const unzippedPath = path.join(tmpDir, 'unzipped');
        if (!fs.existsSync(unzippedPath)) {
            fs.mkdirSync(unzippedPath, { recursive: true });
            await extract(zipFilePath, unzippedPath);
        }

        // Process items in batches
        const totalItems = listData.length;
        for (let i = 0; i < totalItems; i += this.batchSize) {
            const batch = listData.slice(i, i + this.batchSize);
            await this.processBatch(batch, unzippedPath);
        }

        console.log('All items processed successfully.');
    }

    private async processBatch(batch: any[], unzippedPath: string): Promise<void> {
        const promises = batch.map(async (item) => {
            if (this.resumingStates.processedItems.includes(item.id)) {
                console.log(`Skipping already processed item: ${item.id}`);
                return;
            }

            try {
                // Step 1: Create a new callgent
                const callgentResponse = await this.invokeService('create_callgent', {
                    requestBody: {
                        name: item.name,
                        mainTagId: -1,
                    },
                });
                const callgentId = callgentResponse?.data?.id;

                if (!callgentId) {
                    throw new Error('Failed to create callgent: Missing ID in response');
                }

                // Step 2: Create a new server entry
                const serverEntryResponse = await this.invokeService('create_server_entry', {
                    parameters: {
                        adaptorKey: 'restAPI',
                    },
                    requestBody: {
                        type: 'SERVER',
                        callgentId,
                    },
                });
                const entryId = serverEntryResponse?.data?.id;

                if (!entryId) {
                    throw new Error('Failed to create server entry: Missing ID in response');
                }

                // Step 3: Import the collection content
                const collectionFilePath = path.join(unzippedPath, 'downloads', `${item.id}.json`);
                if (!fs.existsSync(collectionFilePath)) {
                    throw new Error(`Collection file not found: ${collectionFilePath}`);
                }

                const collectionContent = fs.readFileSync(collectionFilePath, 'utf-8');
                await this.invokeService('import_collection_content', {
                    requestBody: {
                        entryId,
                        text: collectionContent,
                        format: 'json',
                    },
                });

                // Step 4: Commit the new callgent into hub
                await this.invokeService('commit_callgent_to_hub', {
                    parameters: {
                        id: callgentId,
                    },
                    requestBody: {
                        name: item.name,
                        mainTagId: -1,
                    },
                });

                this.resumingStates.processedItems.push(item.id);
                console.log(`Successfully processed item: ${item.id}`);
            } catch (error) {
                console.error(`Error processing item ${item.id}:`, error);
                throw error; // Rethrow to stop further processing
            }
        });

        await Promise.all(promises);
    }

    public async invokeService(purposeKey: string, args: { parameters?: { [paramName: string]: any }, requestBody?: any }): Promise<any> {
        // This method is predefined and will be provided by the task runner
        // It relays the request to the appropriate endpoint and returns the response
        throw new Error('Method not implemented.');
    }
}