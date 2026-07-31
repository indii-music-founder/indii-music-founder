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
  pageId?: string;
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
    // Sanitize adAccountId (remove 'act_' prefix if provided)
    const cleanAccountId = adAccountId.replace(/^act_/, '');

    // 1. Fetch user's Meta token and pageId from Firestore
    const userDoc = await db.collection('users').doc(userId).collection('analyticsTokens').doc('meta').get();
    
    if (!userDoc.exists) {
      throw new Error('User has not connected a Meta account.');
    }
    const userData = userDoc.data() || {};
    const accessToken = userData.accessToken;
    const pageId = payload.pageId || userData.pageId;

    if (!accessToken) {
      throw new Error('Meta access token missing.');
    }
    if (!pageId) {
      throw new Error('Meta Page ID is missing from user configuration.');
    }

    // 2. Step One: Upload the Image/Video Asset
    let imageHash: string | null = null;
    if (payload.imageUrl) {
      const assetRes = await axios.post(`${FB_BASE_URL}/act_${cleanAccountId}/adimages`, null, {
        params: {
          image_url: payload.imageUrl,
          access_token: accessToken,
        },
      });

      const imagesObj = assetRes.data?.images || {};
      const firstImageKey = Object.keys(imagesObj)[0];
      if (!firstImageKey || !imagesObj[firstImageKey]?.hash) {
        throw new Error('Failed to retrieve image hash from Meta API response.');
      }
      imageHash = imagesObj[firstImageKey].hash;
    }

    // 3. Step Two: Create the Ad Creative Concept
    const creativeRes = await axios.post(`${FB_BASE_URL}/act_${cleanAccountId}/adcreatives`, {
      name: payload.name,
      object_story_spec: {
        page_id: pageId,
        link_data: {
          image_hash: imageHash,
          link: payload.linkUrl,
          message: payload.body,
        }
      },
      access_token: accessToken,
    });

    if (!creativeRes.data?.id) {
      throw new Error('Meta API did not return a valid creative ID.');
    }

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
