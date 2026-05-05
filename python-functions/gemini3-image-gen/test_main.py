import pytest
from flask import Flask
from main import generate_image_gemini3

@pytest.fixture
def app():
    app = Flask(__name__)
    return app

def test_generate_image_gemini3_missing_prompt(app):
    with app.test_request_context(json={"other_key": "value"}):
        from flask import request
        response = generate_image_gemini3(request)
        assert response.status_code == 400
        assert response.get_json() == {"error": "Missing prompt"}

def test_generate_image_gemini3_empty_request(app):
    with app.test_request_context(json=None):
        from flask import request
        response = generate_image_gemini3(request)
        assert response.status_code == 400
        assert response.get_json() == {"error": "Missing prompt"}
