use byteorder::{ByteOrder, LittleEndian};

#[derive(Debug, Clone)]
pub struct TiffTag {
    pub id: u16,
    pub tag_type: u16,
    pub count: u32,
    pub data: Vec<u8>,
}

impl TiffTag {
    pub fn byte(id: u16, val: u8) -> Self {
        Self {
            id,
            tag_type: 1, // BYTE
            count: 1,
            data: vec![val],
        }
    }

    pub fn bytes(id: u16, vals: &[u8]) -> Self {
        Self {
            id,
            tag_type: 1,
            count: vals.len() as u32,
            data: vals.to_vec(),
        }
    }

    pub fn ascii(id: u16, s: &str) -> Self {
        let mut data = s.as_bytes().to_vec();
        data.push(0); // Null terminator
        Self {
            id,
            tag_type: 2, // ASCII
            count: data.len() as u32,
            data,
        }
    }

    pub fn short(id: u16, val: u16) -> Self {
        let mut data = vec![0u8; 2];
        LittleEndian::write_u16(&mut data, val);
        Self {
            id,
            tag_type: 3, // SHORT
            count: 1,
            data,
        }
    }

    pub fn shorts(id: u16, vals: &[u16]) -> Self {
        let mut data = vec![0u8; vals.len() * 2];
        for (i, &v) in vals.iter().enumerate() {
            LittleEndian::write_u16(&mut data[i * 2..i * 2 + 2], v);
        }
        Self {
            id,
            tag_type: 3,
            count: vals.len() as u32,
            data,
        }
    }

    pub fn long(id: u16, val: u32) -> Self {
        let mut data = vec![0u8; 4];
        LittleEndian::write_u32(&mut data, val);
        Self {
            id,
            tag_type: 4, // LONG
            count: 1,
            data,
        }
    }

    pub fn longs(id: u16, vals: &[u32]) -> Self {
        let mut data = vec![0u8; vals.len() * 4];
        for (i, &v) in vals.iter().enumerate() {
            LittleEndian::write_u32(&mut data[i * 4..i * 4 + 4], v);
        }
        Self {
            id,
            tag_type: 4,
            count: vals.len() as u32,
            data,
        }
    }

    pub fn rational(id: u16, num: u32, den: u32) -> Self {
        let mut data = vec![0u8; 8];
        LittleEndian::write_u32(&mut data[0..4], num);
        LittleEndian::write_u32(&mut data[4..8], den);
        Self {
            id,
            tag_type: 5, // RATIONAL
            count: 1,
            data,
        }
    }

    pub fn rationals(id: u16, vals: &[(u32, u32)]) -> Self {
        let mut data = vec![0u8; vals.len() * 8];
        for (i, &(num, den)) in vals.iter().enumerate() {
            LittleEndian::write_u32(&mut data[i * 8..i * 8 + 4], num);
            LittleEndian::write_u32(&mut data[i * 8 + 4..i * 8 + 8], den);
        }
        Self {
            id,
            tag_type: 5,
            count: vals.len() as u32,
            data,
        }
    }

    pub fn srationals(id: u16, vals: &[(i32, i32)]) -> Self {
        let mut data = vec![0u8; vals.len() * 8];
        for (i, &(num, den)) in vals.iter().enumerate() {
            LittleEndian::write_i32(&mut data[i * 8..i * 8 + 4], num);
            LittleEndian::write_i32(&mut data[i * 8 + 4..i * 8 + 8], den);
        }
        Self {
            id,
            tag_type: 10, // SRATIONAL
            count: vals.len() as u32,
            data,
        }
    }
}

pub struct TiffDirectory {
    tags: Vec<TiffTag>,
}

impl Default for TiffDirectory {
    fn default() -> Self {
        Self::new()
    }
}

impl TiffDirectory {
    pub fn new() -> Self {
        Self { tags: Vec::new() }
    }

    pub fn add_tag(&mut self, tag: TiffTag) {
        self.tags.push(tag);
    }

    pub fn update_tag(&mut self, tag: TiffTag) {
        if let Some(pos) = self.tags.iter().position(|t| t.id == tag.id) {
            self.tags[pos] = tag;
        } else {
            self.tags.push(tag);
        }
    }

    /// Sorts tags in ascending order of tag ID as mandated by the TIFF 6.0 specification.
    pub fn sort_tags(&mut self) {
        self.tags.sort_by_key(|t| t.id);
    }

    pub fn tag_count(&self) -> usize {
        self.tags.len()
    }

    pub fn sort_tags_and_count(&mut self) -> usize {
        self.sort_tags();
        self.tags.len()
    }
}

pub struct TiffSerializer;

impl TiffSerializer {
    /// Serializes multiple TIFF directories (IFDs) and binary payload data into
    /// a valid, standards-compliant TIFF byte stream.
    pub fn serialize(ifds: &mut [TiffDirectory], extra_payloads: &[&[u8]]) -> Vec<u8> {
        for ifd in ifds.iter_mut() {
            ifd.sort_tags();
        }

        let mut buffer = Vec::with_capacity(65536);

        // Header: II (Little-endian) + 42
        buffer.extend_from_slice(&[0x49, 0x49, 0x2A, 0x00]);
        // IFD0 offset will be at byte 8
        buffer.extend_from_slice(&[0x08, 0x00, 0x00, 0x00]);

        // We will layout:
        // [Header (8 bytes)]
        // [IFD 0 entries (2 + N*12 + 4 bytes)]
        // ... (other IFDs)
        // [Tag Data Section (values > 4 bytes)]
        // [Image Data Payloads]

        // Calculate layout offsets
        let mut current_offset = 8usize;
        let mut ifd_offsets = Vec::with_capacity(ifds.len());

        for ifd in ifds.iter() {
            ifd_offsets.push(current_offset);
            current_offset += 2 + (ifd.tags.len() * 12) + 4;
        }

        // Data offsets begin after all IFDs
        let mut data_offset = current_offset;
        let mut tag_data_blobs = Vec::new();

        for (ifd_idx, ifd) in ifds.iter().enumerate() {
            let next_ifd_offset = if ifd_idx + 1 < ifds.len() {
                ifd_offsets[ifd_idx + 1] as u32
            } else {
                0u32
            };

            // Write IFD count
            let mut count_bytes = [0u8; 2];
            LittleEndian::write_u16(&mut count_bytes, ifd.tags.len() as u16);
            buffer.extend_from_slice(&count_bytes);

            for tag in &ifd.tags {
                let mut entry = [0u8; 12];
                LittleEndian::write_u16(&mut entry[0..2], tag.id);
                LittleEndian::write_u16(&mut entry[2..4], tag.tag_type);
                LittleEndian::write_u32(&mut entry[4..8], tag.count);

                if tag.data.len() <= 4 {
                    // Fits in value field
                    entry[8..8 + tag.data.len()].copy_from_slice(&tag.data);
                } else {
                    // Write data offset
                    LittleEndian::write_u32(&mut entry[8..12], data_offset as u32);
                    tag_data_blobs.push((data_offset, tag.data.clone()));
                    data_offset += tag.data.len();
                    // Align to 2-byte word boundary
                    if !data_offset.is_multiple_of(2) {
                        data_offset += 1;
                    }
                }
                buffer.extend_from_slice(&entry);
            }

            // Next IFD offset
            let mut next_bytes = [0u8; 4];
            LittleEndian::write_u32(&mut next_bytes, next_ifd_offset);
            buffer.extend_from_slice(&next_bytes);
        }

        // Write tag data blobs
        for (_, blob) in tag_data_blobs {
            buffer.extend_from_slice(&blob);
            if buffer.len() % 2 != 0 {
                buffer.push(0); // Word alignment
            }
        }

        // Write extra binary payloads (e.g. image strips or tiles)
        for payload in extra_payloads {
            if buffer.len() % 2 != 0 {
                buffer.push(0);
            }
            buffer.extend_from_slice(payload);
        }

        buffer
    }
}
