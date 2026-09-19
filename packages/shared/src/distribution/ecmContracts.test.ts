import { describe, expect, it } from 'vitest';
import {
  DuplicateIsrcClusterNotificationIntentSchema,
  DuplicateIsrcClusterRequestIntentSchema,
  MusicalWorkClusterNotificationIntentSchema,
  MusicalWorkClusterRequestIntentSchema,
} from './ecmContracts';

const context={
  messageId:{namespace:'indii.music',value:'message-1'},
  sender:{ddexPartyId:'PADPIDA0000000001',name:'indii.music'},
  recipient:{ddexPartyId:'PADPIDA0000000002',name:'Partner'},
  createdAt:'2026-09-19T22:35:00.000Z',
  standardVersion:'1.0' as const,
  avsVersion:'012' as const,
};

describe('ECM adapter intent contracts',()=>{
  it('accepts a musical-work request by ISWC',()=>{
    const parsed=MusicalWorkClusterRequestIntentSchema.parse({
      messageType:'MusicalWorkClusterRequest',
      context,
      requestClusterId:{namespace:'indii.music',value:'request-1'},
      musicalWork:{iswc:'T1234567890',title:'Example Work'},
    });
    expect(parsed.musicalWork?.iswc).toBe('T1234567890');
  });

  it('requires writer context if a work has no identifier',()=>{
    expect(()=>MusicalWorkClusterRequestIntentSchema.parse({
      messageType:'MusicalWorkClusterRequest',
      context,
      requestClusterId:{value:'request-2'},
      musicalWork:{title:'Unknown Work'},
    })).toThrow();
  });

  it('requires resource identity in a resource-driven request',()=>{
    expect(()=>DuplicateIsrcClusterRequestIntentSchema.parse({
      messageType:'DuplicateIsrcClusterRequest',
      context,
      requestClusterId:{value:'request-3'},
      resource:{
        resourceType:'SoundRecording',
        title:'Recording',
        displayArtistName:'Artist',
      },
    })).toThrow();
  });

  it('captures Part 2 root/member information without merging canonical entities',()=>{
    const parsed=MusicalWorkClusterNotificationIntentSchema.parse({
      messageType:'MusicalWorkClusterNotification',
      context,
      clusterId:{namespace:'indii.music',value:'cluster-mw-1'},
      clusterRoot:{iswc:'T1234567890',title:'Example Work'},
      members:[{
        resource:{
          resourceType:'SoundRecording',
          isrc:'USABC2600001',
          title:'Example Recording',
          displayArtistName:'Artist',
        },
        disambiguation:{
          membershipType:'AudioFile',
          confidencePercent:98,
          linkVerification:'CrossChecked',
        },
      }],
    });
    expect(parsed.members[0]?.disambiguation.confidencePercent).toBe(98);
  });

  it('requires duration for Part 3 root and members',()=>{
    expect(()=>DuplicateIsrcClusterNotificationIntentSchema.parse({
      messageType:'DuplicateIsrcClusterNotification',
      context,
      clusterId:{value:'cluster-isrc-1'},
      clusterRoot:{
        resourceType:'SoundRecording',
        isrc:'USABC2600001',
        title:'Recording',
        displayArtistName:'Artist',
      },
      members:[{
        resource:{
          resourceType:'SoundRecording',
          isrc:'USABC2600002',
          title:'Recording',
          displayArtistName:'Artist',
          durationIso8601:'PT3M30S',
        },
      }],
    })).toThrow();
  });
});
