#!/bin/bash
cd /root/FutureOfDev/opencode
opencode run --daemon --format json --agent ceo --plugin ./plugins/telegram-notifier.ts --plugin ./plugins/event-triggers.ts
