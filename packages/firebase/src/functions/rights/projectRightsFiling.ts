import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { RightsCaseSchema, FilingStateSchema, RightsId } from '@indii/shared';

/** Each track points at the same immutable filing; no external filing is launched here. */
export const projectRightsFiling = onDocumentWritten({ document: 'users/{uid}/rightsFilings/{filingId}', region: 'us-central1', memory: '512MiB', retry: true }, async event => {
  const db = getFirestore();
  const uid = RightsId.parse(event.params.uid);
  const filingId = RightsId.parse(event.params.filingId);
  const source = db.doc(`users/${uid}/rightsFilings/${filingId}`);
  const current = (await source.get()).data();
  if (!current) return; // Evidence records are append-only, not deleted through the application.
  const manifest = RightsCaseSchema.parse(current.manifest);
  const tracks = [...new Set(manifest.works.flatMap(work => work.trackIds))];
  // Transactions read the current source: delayed/repeated trigger delivery cannot regress a projection.
  for (const track of tracks) {
    await db.runTransaction(async tx => {
      const filing = (await tx.get(source)).data();
      if (!filing || filing.manifestHash !== current.manifestHash) return;
      tx.set(db.doc(`registrations/${uid}/tracks/${track}/orgs/loc/filings/${filingId}`), {
        ownerUid: uid, filingId, caseId: manifest.caseId, revision: manifest.revision,
        manifestHash: filing.manifestHash, filingState: FilingStateSchema.parse(filing.state),
        evidenceSource: filing.evidenceSource ?? 'none', externalId: filing.externalId ?? null,
        projectedAt: FieldValue.serverTimestamp(),
      });
    });
  }
});
