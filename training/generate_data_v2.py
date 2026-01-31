"""
Enhanced Synthetic Data Generation (v2)
Uses Faker library for realistic PII generation with diverse templates.
"""

import json
import random
import os
from faker import Faker

# Initialize Faker with multiple locales
fake = Faker(['en_US', 'en_IN', 'en_GB'])

# Configuration
OUTPUT_DIR = "training/data"
TRAIN_FILE = os.path.join(OUTPUT_DIR, "train_synthetic_v2.json")
VAL_FILE = os.path.join(OUTPUT_DIR, "val_synthetic_v2.json")
NUM_SAMPLES = 10000  # Increased from 2000

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

# Realistic Data Generators using Faker
def generate_email():
    """Generate realistic email addresses"""
    return fake.email()

def generate_phone():
    """Generate realistic phone numbers (US + India formats)"""
    formats = [
        fake.phone_number(),  # US format
        f"+91-{random.randint(6,9)}{random.randint(100000000,999999999)}",  # India mobile
        f"{random.randint(100,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}",  # US
        f"({random.randint(100,999)}) {random.randint(100,999)}-{random.randint(1000,9999)}",  # US with parens
    ]
    return random.choice(formats)

def generate_name():
    """Generate realistic person names"""
    return fake.name()

def generate_location():
    """Generate realistic locations"""
    location_types = [
        fake.city(),
        fake.country(),
        fake.address().split('\n')[0],  # Street address only
        f"{fake.city()}, {fake.state_abbr()}",
    ]
    return random.choice(location_types)

# Conversational Templates (ChatGPT/Claude style)
CHAT_TEMPLATES = [
    "Hey, my email is {email}, let me know when you get this!",
    "Can you call me at {phone}? I'm available after 5pm.",
    "I'm {name}, nice to meet you!",
    "Send the package to {location}, thanks!",
    "My contact info: {name}, {email}, {phone}",
    "Draft an email to {email} about the meeting.",
    "Please contact {name} at {phone} for more details.",
    "The event will be held in {location}.",
    "Hi, I'm {name} and I work at {company}.",
    "You can reach me at {email} or {phone}.",
]

# Messy Templates (no spaces, tight formatting)
MESSY_TEMPLATES = [
    "Email:{email}",
    "Name:{name}",
    "Call:{phone}",
    "Location:{location}",
    "Contact:{name},{email},{phone}",
    "email:{email}phone:{phone}",  # No spaces
    "({name}){email}",
    "Name-{name}|Email-{email}",
    "{name}@{location}",
]

# Form-style Templates
FORM_TEMPLATES = [
    "Name: {name}\nEmail: {email}\nPhone: {phone}",
    "Full Name: {name}\nAddress: {location}",
    "Contact Information:\nName: {name}\nEmail: {email}",
    "User: {name}\nLocation: {location}\nPhone: {phone}",
]

# Email Body Templates
EMAIL_BODY_TEMPLATES = [
    "Dear {name},\n\nPlease contact me at {email}.\n\nBest regards,",
    "Hi {name},\n\nYou can reach me at {phone} or {email}.",
    "From: {email}\nTo: {name}\nSubject: Meeting",
]

# Social Media Templates
SOCIAL_TEMPLATES = [
    "Follow me! {name} | {email}",
    "DM me at {email} 📧",
    "Contact: {name} 📞 {phone}",
    "{name} is now at {location}!",
]

ALL_TEMPLATES = (
    CHAT_TEMPLATES * 3 +  # Weight chat templates higher
    MESSY_TEMPLATES * 2 +
    FORM_TEMPLATES +
    EMAIL_BODY_TEMPLATES +
    SOCIAL_TEMPLATES
)

def generate_sample():
    """Generate a single training sample with realistic PII"""
    
    # 70% chance of having PII
    if random.random() < 0.7:
        # Choose template
        template = random.choice(ALL_TEMPLATES)
        
        # Generate PII data
        pii_data = {
            'email': generate_email(),
            'phone': generate_phone(),
            'name': generate_name(),
            'location': generate_location(),
            'company': fake.company(),
        }
        
        # Fill template
        text = template
        entities = []
        
        for key, value in pii_data.items():
            if f'{{{key}}}' in template:
                # Find position before replacement
                start = text.find(f'{{{key}}}')
                if start != -1:
                    # Replace placeholder
                    text = text.replace(f'{{{key}}}', value, 1)
                    end = start + len(value)
                    
                    # Map to entity label
                    label_map = {
                        'email': 'EMAIL',
                        'phone': 'PHONE',
                        'name': 'PER',
                        'location': 'LOC',
                        'company': 'ORG'  # Optional: add ORG support
                    }
                    
                    if key in label_map and key != 'company':  # Skip ORG for now
                        entities.append([start, end, label_map[key]])
        
        return {"text": text, "entities": entities}
    
    else:
        # Negative samples (no PII)
        negative_templates = [
            "Just a quick update on the project.",
            "The meeting is scheduled for tomorrow.",
            "Please review the attached document.",
            "Let me know if you have any questions.",
            "Thanks for your help!",
            "I'll send the details later.",
            "Can we reschedule for next week?",
            "The report is almost ready.",
            "Great work on the presentation!",
            "See you at the conference.",
        ]
        return {
            "text": random.choice(negative_templates),
            "entities": []
        }

def main():
    ensure_dir(OUTPUT_DIR)
    
    print(f"🎲 Generating {NUM_SAMPLES} synthetic samples with Faker...")
    data = [generate_sample() for _ in range(NUM_SAMPLES)]
    
    # Split 80/20
    split_idx = int(NUM_SAMPLES * 0.8)
    train_data = data[:split_idx]
    val_data = data[split_idx:]
    
    with open(TRAIN_FILE, 'w') as f:
        json.dump(train_data, f, indent=2)
        
    with open(VAL_FILE, 'w') as f:
        json.dump(val_data, f, indent=2)
        
    print(f"✅ Generated {len(train_data)} training samples")
    print(f"✅ Generated {len(val_data)} validation samples")
    print(f"💾 Saved to {OUTPUT_DIR}")
    
    # Show sample
    print("\n📝 Sample output:")
    sample = random.choice(train_data)
    print(f"Text: {sample['text']}")
    print(f"Entities: {sample['entities']}")

if __name__ == "__main__":
    main()
