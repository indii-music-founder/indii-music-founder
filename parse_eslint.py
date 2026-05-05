import json

try:
    with open('eslint_output.json', 'r') as f:
        # The file might have NPM prefix lines. Let's find the first '['
        content = f.read()
        start = content.find('[')
        if start != -1:
            data = json.loads(content[start:])
            errors = []
            for file_data in data:
                for msg in file_data.get('messages', []):
                    if msg.get('severity') == 2:
                        errors.append(f"{file_data['filePath']}:{msg['line']} - {msg['message']}")
            
            if errors:
                for e in errors:
                    print(e)
            else:
                print("No severity 2 errors found.")
        else:
            print("No JSON array found.")
except Exception as e:
    print(f"Error parsing: {e}")
