const { HttpsError } = require('firebase-functions/v2/https');
console.log(new HttpsError('internal', 'Image generation failed: crypto is not defined').message);
