def create_handoff_tool(*args, **kwargs):
    def mock_handoff(*a, **kw):
        pass
    return mock_handoff

def create_swarm(*args, **kwargs):
    class MockSwarm:
        def stream(*a, **kw):
            return []
        def invoke(*a, **kw):
            return {}
    return MockSwarm()

