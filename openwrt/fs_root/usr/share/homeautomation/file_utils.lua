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


