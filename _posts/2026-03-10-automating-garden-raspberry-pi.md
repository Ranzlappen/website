---
title: "Automating My Garden with a Raspberry Pi"
date: 2026-03-10
category: "Projects"
tags: [raspberry-pi, automation, gardening, iot]
description: "How I set up automatic watering, soil moisture monitoring, and a live dashboard for my balcony garden."
image:
comments: true
---

Last summer my tomatoes died while I was on vacation. This year I decided the machines could handle it.

## The Hardware Setup

The brains of the operation is a Raspberry Pi 4 running a stripped-down Debian installation. Connected to it are three capacitive soil moisture sensors, a DHT22 temperature/humidity sensor, and a 4-channel relay module controlling solenoid valves on the water line.

Total hardware cost came to about €60, not counting the Pi I already had lying around.

## Reading Soil Moisture

Capacitive sensors are the way to go — resistive ones corrode within weeks. The sensors output an analog signal, so I'm using an ADS1115 ADC module to read them via I2C. A quick Python script polls each sensor every five minutes and logs the readings.

## The Watering Logic

I kept the logic intentionally simple. Each plant zone has a moisture threshold. When the reading drops below the threshold, the corresponding relay opens the solenoid valve for a configurable duration (default: 30 seconds). There's also a maximum daily watering limit to prevent flooding if a sensor fails.

```python
if moisture_reading < THRESHOLD and daily_total < MAX_DAILY_ML:
    open_valve(zone, duration=30)
    log_watering(zone, amount)
```

## The Dashboard

I built a simple dashboard using Flask and Chart.js that displays real-time sensor readings, watering history, and a 7-day moisture trend for each zone. It's accessible over my local network and through a WireGuard VPN when I'm away.

## Lessons Learned

The biggest surprise was how much the moisture readings vary by time of day — direct sunlight heats the sensors and throws off the readings. I ended up adding a calibration offset based on the temperature sensor, which smoothed things out considerably.

## Next Steps

I'm planning to add a weather API integration so the system checks the forecast before watering. No point irrigating if it's going to rain in two hours. I'm also looking at adding a camera module for time-lapse growth tracking.
