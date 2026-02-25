from pymongo import MongoClient

client = MongoClient("mongodb://127.0.0.1:27017")
db = client.riserve_db

docs = list(db.transactions.find({"gross": {"$exists": False}}).limit(5))
print(f"Transactions without 'gross': {len(docs)}")
for doc in docs:
    print(f"ID: {doc.get('id')} - keys: {doc.keys()}")

docs2 = list(db.transactions.find({"commission": {"$exists": False}}).limit(5))
print(f"Transactions without 'commission': {len(docs2)}")

docs3 = list(db.transactions.find({"partner_share": {"$exists": False}}).limit(5))
print(f"Transactions without 'partner_share': {len(docs3)}")
