# Dashboard---fiverr---nodejs-
Invoke-WebRequest -Uri "https://v3-navy-xi.vercel.app/add-user" ` 
-Method POST `
-Headers @{"Content-Type"="application/json"} `
-Body '{
    "deviceno": 1,
    "date": "2024-02-05",
    "time": "14:30:00",
    "ch1": 100,
    "ch2": 101,
    "ch3": 102,
    "ch4": 103,
    "ch5": 104,
    "ch6": 105,
    "ch7": 106,
    "ch8": 107,
    "prevtime": 2000
}'
