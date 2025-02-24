import fs from 'fs';
import path from 'path';
import { extract } from 'zip-lib';

export default class PostmanCollectionImporter {
  public resumingStates: {
    processedItems: string[];
    extractedFiles: Record<string, string>;
  };

  constructor() {
    this.resumingStates = {
      processedItems: [],
      extractedFiles: {},
    };
  }

  async execute(): Promise<void> {
    try {
      // Load the list of items from list.json
      const listData = JSON.parse(fs.readFileSync('list.json', 'utf-8'));
      const items = listData.filter(
        (item: any) => !this.resumingStates.processedItems.includes(item.id),
      );

      // Extract downloads.zip if not already extracted
      if (Object.keys(this.resumingStates.extractedFiles).length === 0) {
        await extract('downloads.zip', './extracted');
        const extractedFiles = fs.readdirSync('./extracted/downloads');
        extractedFiles.forEach((file) => {
          const itemId = file.replace('.json', '');
          this.resumingStates.extractedFiles[itemId] = path.join(
            './extracted/downloads',
            file,
          );
        });
      }

      // Process items in batches
      const batchSize = 5;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (item: any) => {
            try {
              // Step 1: Create a new callgent
              const callgentResponse = await this.invokeService('createCallgent', {
                requestBody: {
                  name: item.name,
                  avatar: item.logo,
                  summary: `${item.name} APIs`,
                  instruction: `This callgent provides access to the ${item.name} APIs.`,
                  mainTagId: -1,
                },
              });
              const callgentId = callgentResponse?.data?.id;
              if (!callgentId) {
                throw new Error('Failed to create callgent');
              }

              // Step 2: Create a new server entry
              const serverEntryResponse = await this.invokeService('createServerEntry', {
                parameters: { adaptorKey: 'restAPI' },
                requestBody: {
                  type: 'SERVER',
                  callgentId,
                },
              });
              const entryId = serverEntryResponse?.data?.id;
              if (!entryId) {
                throw new Error('Failed to create server entry');
              }

              // Step 3: Import the Postman collection
              const collectionFilePath = this.resumingStates.extractedFiles[item.id];
              if (!collectionFilePath || !fs.existsSync(collectionFilePath)) {
                throw new Error('Postman collection file not found');
              }
              const collectionContent = fs.readFileSync(collectionFilePath, 'utf-8');
              await this.invokeService('importCollection', {
                requestBody: {
                  entryId,
                  text: collectionContent,
                  format: 'json',
                },
              });

              // Step 4: Commit the callgent to the hub
              await this.invokeService('commitCallgentToHub', {
                parameters: { id: callgentId },
                requestBody: {
                  name: item.name,
                  avatar: item.logo,
                  summary: `${item.name} APIs`,
                  instruction: `This callgent provides access to the ${item.name} APIs.`,
                  mainTagId: -1,
                },
              });

              // Mark item as processed
              this.resumingStates.processedItems.push(item.id);
              console.log(`Processed item: ${item.name} (${item.id})`);
            } catch (error) {
              console.error(`Error processing item ${item.id}:`, error);
            }
          }),
        );
      }

      console.log('All items processed successfully.');
    } catch (error) {
      console.error('Error during execution:', error);
    }
  }

  async invokeService(purposeKey: string, args: { parameters?: any; requestBody?: any }): Promise<any> {
    // This method is predefined and will be provided by the task runner.
    // It handles the actual API calls to the backend service.
    throw new Error('Method not implemented.');
  }
}