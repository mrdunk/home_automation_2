#!/bin/sh

usage() {
  echo "Usage:"
  echo "  $0 <DEVICENAME> <on|off|query>"
}

if [ ! -f "/tmp/homeautomation/$1" ] ; then
  if [ "$(cat /sys/class/leds/tp-link:blue:relay/brightness)" == "1" ] ; then
    echo "on" > "/tmp/homeautomation/$1"
  else
    echo "off" > "/tmp/homeautomation/$1"
  fi
fi

if [ -z "$1" ] && [ -z "$2" ] ; then
  usage
elif [ "$2" == "on" ]; then
  if [ "$(cat /tmp/homeautomation/$1)" != "on" ] ; then
    echo "Switching on."
    echo 1 > "/sys/class/leds/tp-link:blue:relay/brightness" && echo on > "/tmp/homeautomation/$1"
    echo "done."
  fi
elif [ "$2" == "off" ]; then
  if [ "$(cat /tmp/homeautomation/$1)" != "off" ] ; then
    echo "Switching off."
    echo 0 > "/sys/class/leds/tp-link:blue:relay/brightness" && echo off > "/tmp/homeautomation/$1"
    echo "done."
  fi
elif [ "$2" == "query" ]; then
  cat /tmp/homeautomation/$1
else
  usage
fi
