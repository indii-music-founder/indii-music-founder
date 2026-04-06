// remotion.lambda.ts
// This file is used to configure the Lambda function.
// It is imported by the deployment script and the API route.

export const RemotionLambdaConfig = {
    region: 'us-east-1',
    memorySizeInMb: 2048,
    timeoutInSeconds: 240,
} as const;
