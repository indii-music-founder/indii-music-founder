#!/bin/bash

export_dir="./ft_export_r6"
gcs_bucket="gs://indiios-training-data"

if [ ! -d "$export_dir" ]; then
  echo "Export directory $export_dir not found."
  exit 1
fi

echo "Uploading files from $export_dir to $gcs_bucket..."

for file in "$export_dir"/*.jsonl; do
  # e.g., finance_train.jsonl
  filename=$(basename -- "$file")
  
  # Extracts the agent name by splitting on the last underscore before .jsonl
  # Actually a simpler way: agent name is everything before _train or _eval
  agent="${filename%%_*}"
  
  dest="${gcs_bucket}/${agent}/${filename}"
  echo "Uploading $filename to $dest..."
  
  gsutil cp "$file" "$dest"
done

echo "Upload complete."
