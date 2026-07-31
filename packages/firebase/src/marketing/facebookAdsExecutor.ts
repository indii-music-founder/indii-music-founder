import { getFirestore } from 'firebase-admin/firestore';
import axios from 'axios';

const db = getFirestore();
const FB_GRAPH_VERSION = 'v19.0';
const FB_BASE_URL = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;

export interface AdCreativePayload {
  name: string;
  body: string;
  imageUrl?: string;
  videoUrl?: string;
  linkUrl: string;
}

/**
 * Executes a WRITE ONLY action to the Facebook Marketing API.
 * This prevents account bans caused by high-frequency read scraping.
 */
export async function pushAdCreative(
  userId: string, 
  adAccountId: string, 
  payload: AdCreativePayload
) {
  try {
    // 1. Fetch user's encrypted Meta token from Firestore
    const userDoc = await db.collection('users').doc(userId).collection('analyticsTokens').doc('meta').get();
    
    if (!userDoc.exists) {
      throw new Error('User has not connected a Meta account.');
    }
    const { accessToken } = userDoc.data()!;

    // 2. Step One: Upload the Image/Video Asset
    let imageHash: string | null = null;
    if (payload.imageUrl) {
      const assetRes = await axios.post(`${FB_BASE_URL}/act_${adAccountId}/adimages`, null, {
        params: {
          image_url: payload.imageUrl,
          access_token: accessToken,
        },
      });
      imageHash = assetRes.data.images[Object.keys(assetRes.data.images)[0]].hash;
    }

    // 3. Step Two: Create the Ad Creative Concept
    const creativeRes = await axios.post(`${FB_BASE_URL}/act_${adAccountId}/adcreatives`, {
      name: payload.name,
      object_story_spec: {
        page_id: '<ARTIST_PAGE_ID>', // Fetched from user config
        link_data: {
          image_hash: imageHash,
          link: payload.linkUrl,
          message: payload.body,
        }
      },
      access_token: accessToken,
    });

    // 4. Log the execution to indii's Timeline Audit Trail
    await db.collection('timelineExecutionLogs').add({
      userId,
      action: 'fb_ad_creative_pushed',
      creativeId: creativeRes.data.id,
      timestamp: new Date().toISOString(),
      status: 'success'
    });

    return { success: true, creativeId: creativeRes.data.id };

  } catch (error: any) {
    console.error('Failed to push ad creative:', error);
    return { success: false, error: error?.message || String(error) };
  }
}
