from pymongo import MongoClient

client = MongoClient("mongodb://127.0.0.1:27017")
db = client.ridn_db

docs = db.transactions.find({"gross": {"$exists": False}})
count = 0
for doc in docs:
    total = doc.get("total_amount", 0)
    commission = 0
    partner_share = total
    db.transactions.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "gross": total,
            "commission": commission,
            "partner_share": partner_share
        }}
    )
    count += 1
print(f"Patched {count} transactions in ridn_db.")

db2 = client.riserve_db
docs = db2.transactions.find({"gross": {"$exists": False}})
count2 = 0
for doc in docs:
    total = doc.get("total_amount", 0)
    commission = 0
    partner_share = total
    db2.transactions.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "gross": total,
            "commission": commission,
            "partner_share": partner_share
        }}
    )
    count2 += 1
print(f"Patched {count2} transactions in riserve_db.")
