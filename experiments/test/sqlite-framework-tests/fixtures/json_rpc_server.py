#!/usr/bin/env python3
"""
JSON-RPC 2.0 Mock Server for SQLite Framework Bridge Testing

This mock server simulates the SQLite Extensions Framework's RPC interface
for testing the FixiPlug bridge without requiring the full framework.

Usage:
    python3 json_rpc_server.py [--framework-path PATH]
"""

import sys
import json
import argparse
import time
from typing import Dict, Any, Optional


class JSONRPCServer:
    """Mock JSON-RPC 2.0 server"""

    def __init__(self, framework_path: str):
        self.framework_path = framework_path
        self.request_count = 0

    def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle a JSON-RPC request"""

        # Validate JSON-RPC 2.0 format
        if request.get('jsonrpc') != '2.0':
            return self._error_response(
                request.get('id'),
                -32600,
                'Invalid Request: jsonrpc must be "2.0"'
            )

        method = request.get('method')
        params = request.get('params', {})
        request_id = request.get('id')

        if not method:
            return self._error_response(
                request_id,
                -32600,
                'Invalid Request: method required'
            )

        # Route to method handler
        try:
            result = self._route_method(method, params)
            return self._success_response(request_id, result)

        except Exception as e:
            return self._error_response(
                request_id,
                -32603,
                f'Internal error: {str(e)}',
                {
                    'pythonType': type(e).__name__,
                    'traceback': f'Mock traceback for {type(e).__name__}'
                }
            )

    def _route_method(self, method: str, params: Dict[str, Any]) -> Any:
        """Route method to appropriate handler"""

        self.request_count += 1

        # Pattern learning methods
        if method == 'pattern_learning.get_recommendations':
            return self._mock_get_recommendations(params)

        elif method == 'pattern_learning.find_similar':
            return self._mock_find_similar(params)

        elif method == 'pattern_learning.get_statistics':
            return self._mock_get_statistics(params)

        # Extension generation methods
        elif method == 'extension_generator.analyze_requirements':
            return self._mock_analyze_requirements(params)

        elif method == 'extension_generator.generate':
            return self._mock_generate_extension(params)

        # Agent methods
        elif method == 'agent.detect_type':
            return self._mock_detect_agent_type(params)

        # Test methods
        elif method == 'test.echo':
            return params

        elif method == 'test.sleep':
            duration = params.get('duration', 1)
            time.sleep(duration)
            return {'slept': duration}

        elif method == 'test.error':
            error_type = params.get('type', 'ValueError')
            raise ValueError(f'Mock {error_type}')

        else:
            raise ValueError(f'Method not found: {method}')

    # Mock method implementations

    def _mock_get_recommendations(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Mock pattern recommendations"""
        domain = params.get('domain', 'general')
        return {
            'recommendations': [
                {
                    'pattern_name': f'{domain}_pattern_1',
                    'confidence_score': 0.95,
                    'domain': domain,
                    'success_rate': 0.92,
                    'avg_performance_ms': 150,
                    'usage_count': 42,
                    'description': f'High-performance {domain} pattern',
                    'anti_patterns': []
                },
                {
                    'pattern_name': f'{domain}_pattern_2',
                    'confidence_score': 0.87,
                    'domain': domain,
                    'success_rate': 0.85,
                    'avg_performance_ms': 200,
                    'usage_count': 28,
                    'description': f'Robust {domain} pattern',
                    'anti_patterns': ['avoid_blocking_io']
                }
            ],
            'total_patterns': 2,
            'execution_time_ms': 15
        }

    def _mock_find_similar(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Mock similar pattern search"""
        description = params.get('description', '')
        return {
            'similar_patterns': [
                {
                    'pattern_name': 'similar_pattern_1',
                    'similarity_score': 0.89,
                    'description': f'Pattern similar to: {description}'
                }
            ]
        }

    def _mock_get_statistics(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Mock pattern statistics"""
        return {
            'total_patterns': 156,
            'domains': {
                'finance': 42,
                'analytics': 38,
                'ml': 35,
                'geospatial': 25,
                'text': 16
            },
            'avg_success_rate': 0.91,
            'total_usage': 1243
        }

    def _mock_analyze_requirements(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Mock requirements analysis"""
        description = params.get('description', '')
        return {
            'requirements': {
                'domain': 'analytics',
                'backend': 'python',
                'complexity': 'medium',
                'estimated_time': '2-5 minutes'
            },
            'recommended_path': 'advanced_yaml',
            'confidence': 0.88
        }

    def _mock_generate_extension(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Mock extension generation"""
        description = params.get('description', '')
        backend = params.get('backend_language', 'python')

        return {
            'success': True,
            'extension_path': f'/mock/path/extension_{backend}',
            'backend': backend,
            'generated_files': [
                f'extension_{backend}.py',
                'tests.py',
                'README.md'
            ],
            'test_suite': f'tests_{backend}.py',
            'performance': {
                'estimated_ops_per_sec': 10000 if backend == 'python' else 100000,
                'memory_usage': 1024
            }
        }

    def _mock_detect_agent_type(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Mock agent type detection"""
        return {
            'agent_type': 'claude_code',
            'capabilities': ['rich_feedback', 'code_generation'],
            'token_budget': 5000,
            'tier': 'development'
        }

    def _success_response(self, request_id: str, result: Any) -> Dict[str, Any]:
        """Create success response"""
        return {
            'jsonrpc': '2.0',
            'id': request_id,
            'result': {
                'data': result,
                'metadata': {
                    'executionTime': 50,
                    'cached': False,
                    'version': '1.0.0',
                    'responseTime': int(time.time() * 1000)
                }
            }
        }

    def _error_response(
        self,
        request_id: Optional[str],
        code: int,
        message: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create error response"""
        return {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': {
                'code': code,
                'message': message,
                'data': data or {}
            }
        }

    def run(self):
        """Run the server (stdio mode)"""
        # Send ready signal
        print('READY', flush=True)

        # Process requests from stdin
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                request = json.loads(line)
                response = self.handle_request(request)
                print(json.dumps(response), flush=True)

            except json.JSONDecodeError as e:
                error_response = self._error_response(
                    None,
                    -32700,
                    f'Parse error: {str(e)}'
                )
                print(json.dumps(error_response), flush=True)

            except Exception as e:
                error_response = self._error_response(
                    None,
                    -32603,
                    f'Internal error: {str(e)}'
                )
                print(json.dumps(error_response), flush=True)


def main():
    parser = argparse.ArgumentParser(description='JSON-RPC Mock Server')
    parser.add_argument(
        '--framework-path',
        default='/mock/framework/path',
        help='Framework path (not used in mock)'
    )

    args = parser.parse_args()

    server = JSONRPCServer(args.framework_path)
    server.run()


if __name__ == '__main__':
    main()
