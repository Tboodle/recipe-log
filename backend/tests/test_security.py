import pytest
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token

def test_password_hash_and_verify():
    hashed = hash_password("mysecretpassword")
    assert hashed != "mysecretpassword"
    assert verify_password("mysecretpassword", hashed)
    assert not verify_password("wrongpassword", hashed)

def test_create_and_decode_token():
    token = create_access_token({"sub": "user-123", "household_id": "hh-456"})
    payload = decode_access_token(token)
    assert payload["sub"] == "user-123"
    assert payload["household_id"] == "hh-456"

def test_decode_invalid_token():
    payload = decode_access_token("not.a.valid.token")
    assert payload is None
