import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { analyzeFileURI } from './yourAnalyzingUtility'; // Adjust this import as needed

const ReceiptOCR = () => {
  const [fileMeta, setFileMeta] = useState(null);

  // Corrected fileMeta declaration (removed duplicate declaration)

  useEffect(() => {
    if (fileMeta) {
      analyzeFileURI(fileMeta.uri, fileMeta.type, fileMeta.name); // Used only 3 parameters instead of 5
    }
  }, [fileMeta]);

  return (
    <View>
      <Text>Receipt OCR Component</Text>
    </View>
  );
};

export default ReceiptOCR;