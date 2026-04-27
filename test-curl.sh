#!/bin/bash
TOKEN=$(gcloud auth print-access-token)
MODEL="projects/223837784072/locations/us-central1/models/5672388184277778432"
curl -i -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  https://us-central1-aiplatform.googleapis.com/v1beta1/$MODEL:generateContent \
  -d '{"contents": [{"role": "user", "parts": [{"text": "Hello"}]}]}'
