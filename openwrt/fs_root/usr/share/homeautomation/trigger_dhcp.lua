#!/usr/bin/lua

--[[  ]]--

local DEVICE_CONFIG = '/etc/homeautomation/trigger_dhcp.conf'
local DHCP_FILE = '/tmp/dhcp.leases'


function read_dhcp()
  -- TODO Determine if files have changed before going to this effort.

  -- TODO put this in init function.
  if info.io.dhcp == nil then
    info.io.dhcp = {}
  end

  -- Read dhcp config file to find which devices we care about.
  local file_handle = io.open(DEVICE_CONFIG, "r")
  if not file_handle then
    return
  end

  -- Track if we need to clear cached dhcp entries.
  for mac in next, info.io.dhcp do info.io.dhcp[mac].potentially_stale = true end

  local key, value, mac, google_id, display_name, image, update

  for line in file_handle:lines() do
    key, value = string.match(line, "^%s*trigger_dhcp\.([%a_]+)%s*:%s*(.+)%s*$")
    if key then
      if key == 'mac' then
        mac = value
      elseif key == 'google_id' then
        google_id = value
      elseif key == 'display_name' then
        display_name = value
      elseif key == 'image' then
        image = value
      else
        print ('Error: unknown key: ' .. key)
      end

      if mac and google_id and display_name and image then
        if info.io.dhcp[mac] == nil then
          info.io.dhcp[mac] = {}
        end
        info.io.dhcp[mac].google_id = google_id
        info.io.dhcp[mac].display_name = display_name
        info.io.dhcp[mac].image = image
        info.io.dhcp[mac].potentially_stale = nil

        mac = nil
        google_id = nil
        display_name = nil
        image = nil
      end
    end
  end
  file_handle:close()

  for stored_mac, device in pairs(info.io.dhcp) do
    if info.io.dhcp[stored_mac].potentially_stale then
      info.io.dhcp[stored_mac] = nil
      break -- Not safe to continue with for loop. Cleanup will continue on next iteration.
    end
  end

  -- Read dhcp leases file to see what's actually been on the network recently.
  -- We only cache data already in the DB as we don't care about anything that wasn't in the config file.
  file_handle = io.open(DHCP_FILE, "r")
  if file_handle then
    for line in file_handle:lines() do
      local mac, address, name = string.match(line, "^%s*%d+%s+([%x:]+)%s+([%d\.]+)%s+([%w_-%*]+)")
      if name == '*' then
        name = ''
      end
      
      for stored_mac, device in pairs(info.io.dhcp) do
        if stored_mac == mac then
          info.io.dhcp[stored_mac].address = address
          info.io.dhcp[stored_mac].dhcp_name = name
        end
      end
    end
    file_handle:close()
  end

  for stored_mac, device in pairs(info.io.dhcp) do
    local reachable
    if device.address and os.execute('ping -c1 -W1 ' .. device.address .. ' 1> /dev/null') == 0 then
      -- Is reachable.
      --info.io.dhcp[stored_mac].reachable = true
      reachable = true
    end
    if info.io.dhcp[stored_mac].reachable ~= reachable then
      info.io.dhcp[stored_mac].reachable = reachable
      update = true
    end
  end

  if update then
    print("update")
    colapse_user_tree()
    publish_users()
  end

  return
end

function colapse_user_tree()
  -- TODO put this in init function.
  if info.io.users == nil then
    info.io.users = {}
  end

  -- Clear current entries from the DB so we can re-generate.
  for google_id, _ in  pairs(info.io.users) do
    info.io.users[google_id] = nil
  end

  for mac, device in pairs(info.io.dhcp) do
    if info.io.users[device.google_id] == nil then
      info.io.users[device.google_id] = {devices = {}}
    end
    info.io.users[device.google_id].display_name = device.display_name
    if device.reachable then
      info.io.users[device.google_id].devices[mac] = {}
      info.io.users[device.google_id].devices[mac].dhcp_name = device.dhcp_name
      info.io.users[device.google_id].devices[mac].address = device.address
    end
  end
end

function publish_users()
  local topic, payload

  for google_id, user in  pairs(info.io.users) do
    local count_devices = 0
    for _,_ in pairs(user.devices) do
      count_devices = count_devices +1
    end

    topic = "homeautomation/0/user/" .. google_id
    payload = "count : " .. count_devices
    print(topic, payload)
    mqtt_client:publish(topic, payload)
  end

end

function subscribe_dhcp(subscribe_to)
  --subscribe_to["homeautomation/+/all"] = true
  return subscribe_to
end

function announce_dhcp()
end

