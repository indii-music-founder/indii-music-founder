# Asset Library Red Block Issue - Diagnostic & Fix Plan

## Problem Statement
The Asset Library in the Merchandise Designer is displaying red blocks instead of actual images. This indicates that images are present in the store but failing to render properly.

## Root Cause Analysis

### Data Flow
```
Store (CreativeSlice)
  ├─ generatedHistory: HistoryItem[]
  └─ uploadedImages: HistoryItem[]
         ↓
AssetLibrary Component
  ├─ Combines both arrays into history
  ├─ Filters for type === 'image'
  └─ Renders <img src={asset.url} />
         ↓
Browser rendering
  └─ Red blocks = Failed to load image
```

### Potential Root Causes

#### 1. **Empty/Invalid URLs** (Most Likely)
**Symptoms:**
- Red blocks appearing
- Images count shows correctly (e.g., "3 assets available")
- No console errors about missing components

**Diagnosis:**
```javascript
// Add to AssetLibrary.tsx line 25 (after imageAssets computation)
console.log('AssetLibrary Debug:', {
    totalHistory: history.length,
    imageAssetsCount: imageAssets.length,
    sampleAssets: imageAssets.slice(0, 3).map(a => ({
        id: a.id,
        url: a.url?.substring(0, 50) + '...',
        urlLength: a.url?.length,
        urlType: a.url?.startsWith('data:') ? 'data-uri' :
                 a.url?.startsWith('http') ? 'http' :
                 a.url?.startsWith('blob:') ? 'blob' : 'unknown'
    }))
});
```

**Possible Issues:**
- URLs are empty strings (`""`)
- URLs are undefined/null
- URLs are placeholder strings like "PENDING" or "GENERATING"
- URLs are Firestore references instead of actual image data

#### 2. **CORS/Cross-Origin Issues**
**Symptoms:**
- Console errors: "Access to image at '...' from origin '...' has been blocked by CORS policy"
- Images work in some environments but not others

**Diagnosis:**
- Check browser DevTools Console for CORS errors
- Check Network tab for 403/401 responses

**Fix:**
```typescript
// Add crossOrigin attribute to img tag (AssetLibrary.tsx:164)
<img
    src={asset.url}
    crossOrigin="anonymous"
    alt={asset.prompt || 'Asset'}
    onError={(e) => {
        console.error('Image load failed:', asset.id, asset.url);
        e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
    }}
    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 pointer-events-none"
/>
```

#### 3. **Data URI Storage Issues**
**Symptoms:**
- Images generate successfully but don't persist
- Red blocks after page refresh
- Works initially, fails after reload

**Diagnosis:**
```javascript
// Check what's actually in localStorage/IndexedDB
// Add to browser console:
const checkStorage = async () => {
    const idb = indexedDB.open('firebaseLocalStorageDb');
    idb.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(['firebaseLocalStorage'], 'readonly');
        const store = tx.objectStore('firebaseLocalStorage');
        const req = store.getAll();
        req.onsuccess = () => {
            console.log('IndexedDB contents:', req.result);
        };
    };
};
checkStorage();
```

**Known Issue:**
- StorageService may be saving placeholder URLs to Firestore instead of full data URIs
- CreativeSlice merge logic (lines 164-180) tries to preserve local data URIs but may fail

#### 4. **CSS Background Color**
**Symptoms:**
- Red blocks are exactly that color (#FF0000 or similar)
- No "broken image" icon visible

**Diagnosis:**
```css
/* Check if this exists anywhere in CSS: */
.bg-neutral-800 {
    background-color: #FF0000 !important; /* Suspicious override */
}
```

**Fix:**
- The `bg-neutral-800` class should be dark gray, not red
- Check `tailwind.config.js` for color overrides
- Check global CSS for suspicious `!important` rules

## Immediate Debug Steps

### Step 1: Add Logging to AssetLibrary Component

```typescript
// src/modules/merchandise/components/AssetLibrary.tsx
// Add after line 25 (after imageAssets useMemo):

useEffect(() => {
    console.group('🖼️ Asset Library Debug');
    console.log('Total history items:', history.length);
    console.log('Filtered image assets:', imageAssets.length);

    if (imageAssets.length > 0) {
        const sample = imageAssets[0];
        console.log('Sample asset:', {
            id: sample.id,
            type: sample.type,
            prompt: sample.prompt,
            urlExists: !!sample.url,
            urlLength: sample.url?.length,
            urlPrefix: sample.url?.substring(0, 30),
            timestamp: sample.timestamp,
            origin: sample.origin
        });

        // Check if URL is valid
        if (!sample.url || sample.url === '' || sample.url === 'PENDING') {
            console.error('❌ Invalid URL detected:', sample.url);
        } else if (sample.url.startsWith('data:image')) {
            console.log('✅ Data URI detected (good)');
        } else if (sample.url.startsWith('http')) {
            console.log('⚠️ HTTP URL detected (check CORS)');
        } else if (sample.url.startsWith('blob:')) {
            console.log('⚠️ Blob URL detected (may expire)');
        } else {
            console.warn('⚠️ Unknown URL format:', sample.url.substring(0, 50));
        }
    } else {
        console.warn('No image assets found');
    }

    console.groupEnd();
}, [imageAssets, history]);
```

### Step 2: Add Error Handling to Image Tags

```typescript
// src/modules/merchandise/components/AssetLibrary.tsx line 164
// Replace the <img> tag with:

<img
    src={asset.url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'}
    alt={asset.prompt || 'Asset'}
    onLoad={() => console.log('✅ Image loaded:', asset.id)}
    onError={(e) => {
        console.error('❌ Image failed to load:', {
            assetId: asset.id,
            url: asset.url?.substring(0, 100),
            error: e
        });
        // Fallback to placeholder
        e.currentTarget.style.backgroundColor = '#EF4444';
        e.currentTarget.style.display = 'flex';
        e.currentTarget.style.alignItems = 'center';
        e.currentTarget.style.justifyContent = 'center';
        e.currentTarget.innerHTML = '<span style="color:white;font-size:10px;">Failed</span>';
    }}
    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 pointer-events-none"
/>
```

### Step 3: Check Store Initialization

```typescript
// Add to src/core/store/slices/creativeSlice.ts after initializeHistory call
// Or run in browser console:

useStore.getState().generatedHistory.forEach((item, idx) => {
    console.log(`History[${idx}]:`, {
        id: item.id,
        type: item.type,
        hasUrl: !!item.url,
        urlLength: item.url?.length,
        urlType: item.url?.startsWith('data:') ? 'data-uri' :
                 item.url?.startsWith('http') ? 'http' : 'unknown',
        prompt: item.prompt?.substring(0, 30)
    });
});
```

### Step 4: Verify Tailwind Colors

```bash
# Check if bg-neutral-800 is actually neutral gray
# In browser console:
const testDiv = document.createElement('div');
testDiv.className = 'bg-neutral-800';
document.body.appendChild(testDiv);
const color = window.getComputedStyle(testDiv).backgroundColor;
console.log('bg-neutral-800 actual color:', color);
document.body.removeChild(testDiv);
```

## Solution Strategies

### Strategy A: Fix Empty URLs (if URLs are invalid)

**Problem:** Assets have empty or placeholder URLs

**Fix:**
1. Check where images are added to history (image generation, upload)
2. Ensure URLs are set correctly before adding to store
3. Update StorageService to preserve full data URIs

```typescript
// src/services/StorageService.ts
// When saving, ensure full URL is preserved:
async saveItem(item: HistoryItem) {
    // Don't replace data URIs with placeholders
    if (item.url && item.url.startsWith('data:')) {
        // Save full data URI locally (IndexedDB)
        await this.saveToIndexedDB(item);

        // Optionally upload to Cloud Storage and save Cloud URL to Firestore
        // const cloudUrl = await this.uploadToCloudStorage(item.url);
        // await this.saveToFirestore({ ...item, url: cloudUrl });
    }
}
```

### Strategy B: Add Loading States

**Problem:** Images take time to load

**Fix:**
```typescript
// Add loading state to each image
const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

// In render:
<div className="relative">
    {loadingStates[asset.id] && (
        <div className="absolute inset-0 bg-neutral-800 animate-pulse flex items-center justify-center">
            <span className="text-xs text-neutral-500">Loading...</span>
        </div>
    )}
    <img
        src={asset.url}
        onLoadStart={() => setLoadingStates(prev => ({ ...prev, [asset.id]: true }))}
        onLoad={() => setLoadingStates(prev => ({ ...prev, [asset.id]: false }))}
        onError={() => setLoadingStates(prev => ({ ...prev, [asset.id]: false }))}
        // ... rest of props
    />
</div>
```

### Strategy C: Implement Fallback UI

**Problem:** Some images will always fail to load

**Fix:**
```typescript
// Create a fallback component
const ImageWithFallback: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
    const [error, setError] = useState(false);

    if (error || !src) {
        return (
            <div className="w-full h-full bg-neutral-800 flex flex-col items-center justify-center p-2">
                <ImageIcon size={24} className="text-neutral-600 mb-1" />
                <span className="text-[10px] text-neutral-600 text-center">{alt}</span>
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            onError={() => setError(true)}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
    );
};
```

## Testing Checklist

- [ ] Open browser DevTools Console
- [ ] Navigate to Merchandise Designer
- [ ] Check console for "🖼️ Asset Library Debug" logs
- [ ] Note the URL format for assets (data:, http:, blob:, or invalid)
- [ ] Check Network tab for failed image requests
- [ ] Inspect element on red block - check computed background-color
- [ ] Try generating a new image via AI Generation
- [ ] Check if new image appears correctly
- [ ] Refresh page and see if images persist
- [ ] Check if images appear after clearing browser cache

## Expected Results After Fix

**Success Criteria:**
- ✅ Actual images render instead of red blocks
- ✅ Console shows valid data URIs or accessible URLs
- ✅ No image load errors in console
- ✅ Images persist after page refresh
- ✅ Drag-and-drop works with visible thumbnails

**Performance Metrics:**
- Images load within 500ms
- No layout shift when images load
- Smooth hover transitions

## Next Steps

1. **Immediate**: Add debug logging (Step 1)
2. **Quick win**: Add error handling (Step 2)
3. **Investigation**: Run console checks (Steps 3-4)
4. **Fix**: Implement appropriate strategy based on findings
5. **Test**: Verify with checklist above
6. **Document**: Update this plan with actual root cause found

---

**Last Updated**: 2026-01-15
**Status**: 🔍 Diagnosis Phase
**Priority**: 🔴 Critical (blocks core functionality)
