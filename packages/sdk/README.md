# @indiios/sdk

Official TypeScript SDK for indiiOS REST API.

## Installation

```bash
npm install @indiios/sdk
# or
yarn add @indiios/sdk
```

## Quick Start

```typescript
import { createClient } from '@indiios/sdk';

const client = createClient({
  apiUrl: 'https://api.indiios.com',
  apiKey: 'your-api-key'
});

// Get a track
const track = await client.getTrack('track-id');

// Create a new track
const newTrack = await client.createTrack({
  title: 'My Track',
  duration: 180000,
  genre: 'Electronic'
});

// List tracks with pagination
const tracks = await client.listTracks({ limit: 10, offset: 0 });
```

## Features

- **Fully typed** - Full TypeScript support with types from `@indiios/shared`
- **Error handling** - Built-in retry logic with exponential backoff
- **Validation** - Request validation using Zod schemas
- **ESM & CommonJS** - Works with both module systems
- **Lightweight** - No heavy dependencies

## API Reference

### Tracks

```typescript
// Get a single track
const track = await client.getTrack(trackId);

// List all tracks
const tracks = await client.listTracks({ limit: 10, offset: 0 });

// Create a track
const track = await client.createTrack({
  title: 'Track Title',
  duration: 180000,
  genre: 'Electronic',
  bpm: 128
});

// Update a track
const updated = await client.updateTrack(trackId, {
  title: 'New Title'
});

// Delete a track
await client.deleteTrack(trackId);
```

### Distributions

```typescript
// Get a distribution
const dist = await client.getDistribution(distributionId);

// List distributions
const dists = await client.listDistributions();

// Create a distribution
const dist = await client.createDistribution({
  trackId: 'track-id',
  platforms: ['spotify', 'apple', 'amazon']
});

// Submit for distribution
const submitted = await client.submitDistribution(distributionId);
```

### Analytics

```typescript
// Get all events
const events = await client.getEvents({ limit: 100 });

// Get events by type
const trackEvents = await client.getEventsByType('track_created');
```

### Account

```typescript
// Get user profile
const profile = await client.getProfile();

// Update profile
const updated = await client.updateProfile({
  name: 'New Name'
});
```

## Error Handling

```typescript
import { IndiiOSClient, IndiiOSError } from '@indiios/sdk';

try {
  const track = await client.getTrack('invalid-id');
} catch (error) {
  if (error instanceof IndiiOSError) {
    console.log('Status:', error.statusCode);
    console.log('Details:', error.details);
  }
}
```

## Configuration

```typescript
const client = createClient({
  apiUrl: 'https://api.indiios.com',
  apiKey: 'your-api-key',
  timeout: 30000 // Default: 30000ms
});
```

## Requirements

- Node.js >= 18.0.0
- TypeScript 5.0+

## License

MIT
