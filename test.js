const { isFirebaseE2EMockEnabled } = require('./packages/renderer/src/utils/e2eMode.js') || {};
console.log(typeof isFirebaseE2EMockEnabled);
