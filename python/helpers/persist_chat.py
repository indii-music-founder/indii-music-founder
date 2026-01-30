
# Stub implementation

def remove_chat(chat_id):
    pass

class AgentContext:
    def __init__(self, config=None, type=None):
        pass
    
    @staticmethod
    def get(chat_id):
        return None
    
    @staticmethod
    def remove(chat_id):
        pass
        
    def reset(self):
        pass
    
    def communicate(self, message):
        pass
        
    @property
    def id(self):
        return "chat_id"
