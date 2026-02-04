---
alwaysApply: false
description: every time there is a change in the database seed files make a log file insert it on database seed logs folder

---
use the database seed logs folder to store the logs
format:
- date
- time
- user
- action
- table
- column
- old value
- new value
- command that was used to make the change

and for the data seeding files please add it on data-seeder files folder