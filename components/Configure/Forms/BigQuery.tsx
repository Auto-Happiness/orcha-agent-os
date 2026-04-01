import { Grid, TextInput, PasswordInput, Stack, Text } from "@mantine/core";
import { inputStyles } from "@/lib/styles";

export function BigQueryForm() {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <TextInput label="Project ID" placeholder="e.g. gcp-prod-analytics" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <TextInput label="Dataset ID" placeholder="e.g. sales_data_v1" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={12}>
          <PasswordInput 
            label="Service Account JSON" 
            placeholder="Paste your JSON credentials from Google Cloud Console..." 
            styles={inputStyles} 
            description="Minimum permissions: BigQuery Data Viewer & Metadata Viewer."
          />
      </Grid.Col>
    </Grid>
  );
}
