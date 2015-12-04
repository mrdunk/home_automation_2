#!/usr/bin/lua


-- Test if a path exists on the file system.
function is_file_or_dir(fn)
    return os.rename(fn, fn)
end

function mkdir(dir)
  return os.execute("mkdir -p " .. dir)
end

-- Move a file or directory.
function mv(source, dest)
  return os.rename(source, dest)
end

-- Test if a path exists on the file system. Wild cards can be used.
function match_file_or_dir(fn)
  return os.execute("[ -e  " .. fn .. " ]")
end

-- Return hostname of the host running this code.
function hostname()
  local handle = io.popen("uname -snr")
  local uname = handle:read("*line")
  handle:close()
  return string.match(uname, "[%w]+[%s]([%w%p]+)[%s][%w%p]+")
end

-- Return last modification time of a file
function file_mod_time(filename)
  local handle = io.popen("date -r " .. filename)
  if handle then
    local output = handle:read("*line")
    handle:close()
    return output
  end
  return
end


function sanitize_text(text)
  return text:gsub('[^%.%-_%w%s:]','')
end

function sanitize_filename(filename)
  if filename:gsub('[%._%w]','') == '' then
    return filename
  end
  return ''
end

function sanitize_mac_address(mac)
  mac = mac:match('(%x%x:%x%x:%x%x:%x%x:%x%x:%x%x)')
  return mac:gsub(':', '_')
end

function sanitize_url(url)
  -- TODO
  return url
end

function sanitize_digits(digits)
  if digits:gsub('%d', '') == '' then
    return digits
  end
  return ''
end

function sanitize_network_address(address)
  -- IPv4
  if address:match('(%d+%.%d+%.%d+%.%d+)') ~= '' then
    return address
  end

  -- IPv6
  if address:gsub('[%x:]' , '') == '' then
    return address
  end
  return ''
end

function sanitize_topic(topic)
  if topic:gsub('[%w%-_/]' , '') == '' then
    return topic
  end
  return ''
end

function sanitize_topic_atom(topic)
  if topic:gsub('[%w%-_]' , '') == '' then
    return topic
  end
  return ''
end

function split(path, deliminator)
  local return_list={} ; i=1
  for str in path:gmatch("([^" .. deliminator .. "]+)") do
    return_list[i] = str
    i = i + 1
  end
  return return_list
end

function path_to_var(path)
  return path:gsub('/', '__')
end

function var_to_path(var)
  return var:gsub('__', '/')
end

function is_mac_address(mac)
  return mac:match('(%x%x:%x%x:%x%x:%x%x:%x%x:%x%x)')
end

function is_sanitized_mac_address(mac)
  return mac:match('(%x%x_%x%x_%x%x_%x%x_%x%x_%x%x)')
end
