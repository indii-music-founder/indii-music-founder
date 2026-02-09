// Updated to safely handle undefined attachments

import React from 'react';

interface Attachment {
  id: string;
  name: string;
}

interface Props {
  attachments?: Attachment[];
}

const AttachmentList: React.FC<Props> = ({ attachments }) => {
  if (!attachments || attachments.length === 0) {
    return <div>No attachments available</div>;
  }

  return (
    <ul>
      {attachments.map((attachment) => (
        <li key={attachment.id}>{attachment.name}</li>
      ))}
    </ul>
  );
};

export default AttachmentList;
