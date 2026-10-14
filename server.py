"""Run the local Wind Studio app: python server.py."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import functools

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent / 'web'
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(directory))
    print(f'Wind Studio is ready at http://localhost:{args.port}', flush=True)
    try:
        ThreadingHTTPServer(('127.0.0.1', args.port), handler).serve_forever()
    except KeyboardInterrupt:
        pass
