---
alwaysApply: false
description: when there is an update in the schma make a log file insert it on database schema update logs folder
---
when there is an update in the schma make a log file
use the database schema update logs folder to store the logs
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
