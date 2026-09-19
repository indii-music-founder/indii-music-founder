import { describe, expect, it } from 'vitest';
import {
  EntityClusterAssertionSchema,
  MusicRelationshipSchema,
} from './musicRelationship';

const now='2026-09-19T22:30:00.000Z';
const provenance={
  state:'EXTERNAL_VERIFIED' as const,
  sourceType:'EXTERNAL_SERVICE' as const,
  sourceId:'fixture',
  evidence:[],
  observedAt:now,
};

describe('MusicRelationshipSchema',()=>{
  it('represents a work embodied in a recording without changing either identity',()=>{
    const relationship=MusicRelationshipSchema.parse({
      schemaVersion:'music-relationship.v1',
      id:'rel-1',
      fromEntityId:'work-1',
      toEntityId:'recording-1',
      type:'EMBODIED_IN',
      provenance,
      createdAt:now,
      updatedAt:now,
    });
    expect(relationship.fromEntityId).toBe('work-1');
    expect(relationship.toEntityId).toBe('recording-1');
  });

  it('rejects self-referential relationships',()=>{
    expect(()=>MusicRelationshipSchema.parse({
      schemaVersion:'music-relationship.v1',
      id:'rel-self',
      fromEntityId:'recording-1',
      toEntityId:'recording-1',
      type:'DERIVED_FROM',
      provenance,
      createdAt:now,
      updatedAt:now,
    })).toThrow();
  });
});

describe('EntityClusterAssertionSchema',()=>{
  it('preserves a duplicate-ISRC cluster as an assertion rather than a merge',()=>{
    const cluster=EntityClusterAssertionSchema.parse({
      schemaVersion:'entity-cluster-assertion.v1',
      id:'cluster-1',
      assertionType:'TREAT_AS_SAME_RECORDING',
      sourceStandard:{family:'DDEX_ECM',part:'ECM_ISRC',version:'1.0'},
      members:[
        {entityId:'recording-a',confidencePercent:96,linkVerification:'CROSS_CHECKED',membershipBasis:'AUDIO_AND_METADATA',provenance},
        {entityId:'recording-b',confidencePercent:91,linkVerification:'VERIFIED_BY_HUMAN',membershipBasis:'REFERENCE_METADATA',provenance},
      ],
      assertedAt:now,
      provenance,
    });
    expect(cluster.members.map(member=>member.entityId)).toEqual(['recording-a','recording-b']);
    expect(cluster.assertionType).toBe('TREAT_AS_SAME_RECORDING');
  });

  it('rejects duplicate membership rows',()=>{
    expect(()=>EntityClusterAssertionSchema.parse({
      schemaVersion:'entity-cluster-assertion.v1',
      id:'cluster-dup',
      assertionType:'SAME_UNDERLYING_MUSICAL_WORK',
      members:[
        {entityId:'recording-a',provenance},
        {entityId:'recording-a',provenance},
      ],
      assertedAt:now,
      provenance,
    })).toThrow();
  });
});
