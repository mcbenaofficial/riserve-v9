from pydantic import BaseModel
from typing import Optional, List

try:
    class BookingFieldConfig(BaseModel):
        field_name: str
        label: str
        field_type: str = "text"
        required: bool = False
        enabled: bool = True
        placeholder: Optional[str] = None
        options: Optional[List[str]] = None
        order: int = 0

    print("Model definition successful")
    config = BookingFieldConfig(field_name="test", label="Test")
    print("Model instantiation successful")
except Exception as e:
    print(f"Error: {e}")
