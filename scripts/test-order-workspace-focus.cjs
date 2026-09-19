const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const ts = require('typescript')

// Exercise the provider's actual event subscriptions without network or a login.
function mountProvider(source) {
  const effects = []
  const events = new EventTarget()
  let updates = 0
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useCallback: fn => fn,
    useMemo: fn => fn(),
    useState: initial => [initial, () => { updates += 1 }],
    useEffect: effect => effects.push(effect),
  }
  const mocks = {
    react,
    'react/jsx-runtime': { jsx: () => null },
    'next-auth/react': { useSession: () => ({ status: 'loading', data: null }) },
    'next/navigation': { useRouter: () => ({}) },
    '@/lib/workspaceOrder': { selectedVisibleOrder: () => null },
    '@/lib/workspaceHospital': {},
  }
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports = {}
  new Function('require', 'exports', 'window', compiled)(name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`)
    return mocks[name]
  }, exports, events)
  exports.OrderWorkspaceProvider({ children: null })
  const cleanups = effects.map(effect => effect())
  return { events, updates: () => updates, unmount: () => cleanups.forEach(fn => fn?.()) }
}
const source = fs.readFileSync('src/components/OrderWorkspace.tsx', 'utf8')

test('returning from a document tab does not reload the workspace', () => {
  const provider = mountProvider(source)
  for (let n = 0; n < 3; n++) provider.events.dispatchEvent(new Event('focus'))
  assert.equal(provider.updates(), 0)
  provider.unmount()
})

test('actual order changes still refresh and the listener is removed on unmount', () => {
  const provider = mountProvider(source)
  provider.events.dispatchEvent(new Event('orders-changed'))
  assert.equal(provider.updates(), 1)
  provider.unmount()
  provider.events.dispatchEvent(new Event('orders-changed'))
  assert.equal(provider.updates(), 1)
})

test('regression harness reproduces the previous focus reload', () => {
  const oldSource = source.replace("window.addEventListener('orders-changed', refresh)", "window.addEventListener('focus', refresh); window.addEventListener('orders-changed', refresh)")
  const provider = mountProvider(oldSource)
  provider.events.dispatchEvent(new Event('focus'))
  assert.equal(provider.updates(), 1)
  provider.unmount()
})
