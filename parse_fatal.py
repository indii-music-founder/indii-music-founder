import json

try:
    with open('eslint_output.json', 'r') as f:
        content = f.read()
        start = content.find('[')
        if start != -1:
            data = json.loads(content[start:])
            fatals = []
            for file_data in data:
                for msg in file_data.get('messages', []):
                    if msg.get('fatal'):
                        fatals.append(f"{file_data['filePath']}:{msg['line']} - {msg['message']}")
            
            if fatals:
                for f_msg in fatals:
                    print(f_msg)
            else:
                print("No fatal errors found.")
        else:
            print("No JSON array found.")
except Exception as e:
    print(f"Error parsing: {e}")
