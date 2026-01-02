
import os

def parse_latest_error():
    log_file = 'server_stdout.log'
    if not os.path.exists(log_file):
        print("Log file not found.")
        return

    with open(log_file, 'r', encoding='utf-16le', errors='ignore') as f:
        lines = f.readlines()

    last_request_idx = -1
    for i in range(len(lines) - 1, -1, -1):
        if '--- New Request ---' in lines[i]:
            last_request_idx = i
            break

    if last_request_idx == -1:
        print("No requests found in log.")
        # Just print the last 20 lines
        print("Last 20 lines of log:")
        for line in lines[-20:]:
            print(line.strip())
        return

    print("--- Extracting Latest Request Context ---")
    for line in lines[last_request_idx:]:
        print(line.strip())

if __name__ == "__main__":
    parse_latest_error()
