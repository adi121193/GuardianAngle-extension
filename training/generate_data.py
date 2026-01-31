
"""
ModelOps Data Generation Script
Generates synthetic data for NER training (PII detection).
"""

import json
import random
import os

# Configuration
OUTPUT_DIR = "training/data"
TRAIN_FILE = os.path.join(OUTPUT_DIR, "train.json")
VAL_FILE = os.path.join(OUTPUT_DIR, "val.json")
NUM_SAMPLES = 2000  # Increased for better pattern coverage

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

# Mock Data Generators
def generate_email():
    domains = ["gmail.com", "yahoo.com", "work.net", "example.org"]
    names = ["john", "jane", "alice", "bob", "carl", "sarah", "mike", "emma", "david"]
    return f"{random.choice(names)}.{random.randint(1,99)}@{random.choice(domains)}"

def generate_phone():
    return f"{random.randint(100,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}"

def generate_name():
    first_names = ["John", "Jane", "Alice", "Bob", "Charlie", "David", "Emma", "Frank", "Grace", "Henry", "Isabella", "Jack", "William", "Sophia", "Oliver", "Lucas"]
    last_names = ["Smith", "Doe", "Johnson", "Brown", "Wilson", "Taylor", "Anderson", "Thomas", "White", "Harris", "Martin", "Thompson"]
    return f"{random.choice(first_names)} {random.choice(last_names)}"

def generate_location():
    cities = ["New York", "London", "Paris", "Tokyo", "Berlin", "Sydney", "Toronto", "Mumbai", "Dubai", "Singapore", "San Francisco", "Chicago", "Boston"]
    countries = ["USA", "UK", "France", "Japan", "Germany", "Australia", "Canada", "India", "UAE", "Singapore"]
    return random.choice(cities + countries)

def generate_sample():
    # 60% chance of having PII
    if random.random() < 0.6:
        pii_type = random.choice(["EMAIL", "PHONE", "PER", "LOC"])
        
        if pii_type == "EMAIL":
            entity = generate_email()
            templates = [
                f"My email is {entity} please contact me.",
                f"Contact: {entity}",
                f"Send details to {entity} asap.",
                f"{entity} is my address.",
                f"Email:{entity}",     # Messy: No space
                f"mail: {entity}.",    # Lowercase label
                f"({entity})",         # Brackets
                f"reach me at {entity}thanks", # Merged text
                f"Data:{entity}End"    # Merged both sides
            ]
            text = random.choice(templates)
            start = text.find(entity)
            end = start + len(entity)
            return {"text": text, "entities": [[start, end, "EMAIL"]]}
            
        elif pii_type == "PHONE":
            entity = generate_phone()
            templates = [
                f"Call {entity}.",
                f"Ph: {entity}",
                f"Cell:{entity}",      # Messy: No space
                f"Mob-{entity}",       # Dash separator
                f"call me({entity})",  # Merged
                f"dial {entity}...",   # Trailing dots
                f"reach: {entity}"
            ]
            text = random.choice(templates)
            start = text.find(entity)
            end = start + len(entity)
            return {"text": text, "entities": [[start, end, "PHONE"]]}
            
        elif pii_type == "PER":
            entity = generate_name()
            templates = [
                f"Name: {entity}",
                f"I am {entity}.",
                f"Name:{entity}",      # Messy: No space
                f"User: {entity} active",
                f"Employee-{entity}",
                f"meet {entity}!",
                f"profile.Name: {entity}", # Simulated structure
                f"Hi,{entity} here"     # Merged comma
            ]
            text = random.choice(templates)
            start = text.find(entity)
            end = start + len(entity)
            return {"text": text, "entities": [[start, end, "PER"]]}
            
        elif pii_type == "LOC":
            entity = generate_location()
            templates = [
                f"Location: {entity}",
                f"Address:{entity}",   # Messy: No space
                f"City-{entity}",
                f"living in {entity}.",
                f"from:{entity}",
                f"shipping to {entity}."
            ]
            text = random.choice(templates)
            start = text.find(entity)
            end = start + len(entity)
            return {"text": text, "entities": [[start, end, "LOC"]]}
            
    else:
        # Negative samples
        texts = [
            "Just a quick update.",
            "Type f to pay respects.",
            "Review section f.",
            "Is this safe?",
            "Hello world",
            "Update the status.",
            "Can we meet at 5?",
            "I need to buy some apples.",
            "Process failed to start.",
            "Function undefined at line 40.",
            "Let's go for lunch.",
            "The weather is nice today.",
            "id: 12345",
            "version: 1.0.0",
            "Refer to page 5."
        ]
        return {
            "text": random.choice(texts),
            "entities": []
        }

def main():
    ensure_dir(OUTPUT_DIR)
    
    print(f"Generating {NUM_SAMPLES} samples...")
    data = [generate_sample() for _ in range(NUM_SAMPLES)]
    
    # Split 80/20
    split_idx = int(NUM_SAMPLES * 0.8)
    train_data = data[:split_idx]
    val_data = data[split_idx:]
    
    with open(TRAIN_FILE, 'w') as f:
        json.dump(train_data, f, indent=2)
        
    with open(VAL_FILE, 'w') as f:
        json.dump(val_data, f, indent=2)
        
    print(f"Done. Saved to {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
