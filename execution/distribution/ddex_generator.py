import xml.etree.ElementTree as ET
import datetime
import uuid
import json
import sys

def generate_ddex(artist_data):
    """
    Generates a mock DDEX ERN 4.3 Message based on standard music industry schema.
    """
    message_id = str(uuid.uuid4())
    timestamp = datetime.datetime.now().isoformat()

    # Root element
    root = ET.Element("ERNMessage", {
        "xmlns": "http://ddex.net/xml/ern/43",
        "MessageSchemaVersionId": "4.3"
    })

    # Message Header
    header = ET.SubElement(root, "MessageHeader")
    ET.SubElement(header, "MessageId").text = message_id
    ET.SubElement(header, "MessageSender").text = "DPID:INDII_OS_PROD"
    ET.SubElement(header, "MessageRecipient").text = "DPID:APPLE_MUSIC_INGEST"
    ET.SubElement(header, "MessageCreatedDateTime").text = timestamp

    # Resource List (The Audio/Video Assets)
    resource_list = ET.SubElement(root, "ResourceList")
    for track in artist_data.get("tracks", []):
        recording = ET.SubElement(resource_list, "SoundRecording")
        ET.SubElement(recording, "ResourceReference").text = f"A{track['id']}"
        
        type_id = ET.SubElement(recording, "Type")
        type_id.text = "Track"

        id_elem = ET.SubElement(recording, "SoundRecordingId")
        ET.SubElement(id_elem, "ISRC").text = track.get("isrc", "US-MOCK-26-00001")

        title_elem = ET.SubElement(recording, "DisplayTitle")
        ET.SubElement(title_elem, "TitleText").text = track.get("title", "Untitled")

    # Release List (The Album/Single Product)
    release_list = ET.SubElement(root, "ReleaseList")
    release = ET.SubElement(release_list, "Release")
    ET.SubElement(release, "ReleaseReference").text = "R1"
    
    id_elem = ET.SubElement(release, "ReleaseId")
    ET.SubElement(id_elem, "GRid").text = f"A1-{message_id[:12]}"
    ET.SubElement(id_elem, "UPC").text = artist_data.get("upc", "123456789012")

    title_elem = ET.SubElement(release, "DisplayTitle")
    ET.SubElement(title_elem, "TitleText").text = artist_data.get("album_title", "Single")

    return ET.tostring(root, encoding='utf-8', method='xml').decode('utf-8')

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)

    try:
        data = json.loads(sys.argv[1])
        xml_output = generate_ddex(data)
        print(xml_output)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
