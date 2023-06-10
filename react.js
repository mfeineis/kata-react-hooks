self.React = class React {
    static createElement(tag, props, ...children) {
        const el = { tag, props, children, vdom: null };
        const vdom = React._createVdom(el);
        el.vdom = vdom;
        return el;
    }
    static _pulse() {
        for (const fn of React._pulseListeners) {
            fn();
        }
    }
    static _pulseListeners = [];
    static _createVdom(el) {
        let type;
        if (!el || typeof el === "string" || typeof el === "number") {
            type = "text";
        } else if (typeof el.tag === "string") {
            type = "native";
        } else {
            type = "custom";
        }
        const comp = el.tag.prototype instanceof React.Component;
        const vdom = {
            type,
            fn: typeof el.tag === 'function' && !comp,
            comp,
            instance: null,
            subtree: null,
            recreate: null,
            update: null,
            props: null,
            state: null,
            hooks: [],
            slotState(slice, i) {
                if (!Array.isArray(vdom.state)) {
                    vdom.state = [];
                }
                const newState = [...vdom.state];
                newState[i] = slice;
                // console.log("..setState", slice, vdom);
                vdom.update(newState);
            },
        };
        if (vdom.fn) {
            vdom.recreate = (props) => {
                vdom.props = props;
                React._hooks = vdom.hooks = [];
                React._vdom = vdom;
                vdom.subtree = el.tag(props);
                console.log(`<${el.tag.name} /> hooks =`, ...vdom.hooks);
                React._vdom = null;
                React._hooks = null;
            };
            vdom.update = (state, props = null) => {
                if (props) {
                    vdom.recreate(props);
                }
                vdom.state = state;
                React._hooks = [];
                React._vdom = vdom;
                vdom.subtree = el.tag(props);
                console.log(`update <${el.tag.name} />`);
                for (let i = 0; i < React._hooks.length; i += 1) {
                    const oldHook = vdom.hooks[i];
                    const hook = React._hooks[i];
                    vdom.hooks[i] = hook;
                    console.log('..state[', i, '] =', oldHook, '->', hook);
                }
                React._vdom = null;
                React._hooks = null;
                React._pulse();
            };
        } else if (vdom.comp) {
            vdom.recreate = (props) => {
                vdom.props = props;
                vdom.instance = new el.tag(props);
                vdom.state = vdom.instance.state;
                vdom.subtree = vdom.instance.render();
                console.log(`<${el.tag.name} />`);
            };
            vdom.update = (state, props = null) => {
                if (props) {
                    vdom.recreate(props);
                }
                vdom.state = state;
                vdom.instance.state = state;
                vdom.subtree = vdom.instance.render();
                React._pulse();
            };
        } else {
            vdom.recreate = (props) => {
                vdom.props = props;
            };
            vdom.update = (state, props = null) => {
                if (props) {
                    vdom.recreate(props);
                }
                vdom.state = state;
            };
        }
        vdom.recreate(el.props);
        return vdom;
    }
    static useRef(defaultValue = undefined) {
        const vdom = React._vdom;
        const hooks = React._hooks;
        const index = hooks.length;

        const slot = vdom.hooks[index] ?? Object.defineProperty({}, "current", {
            enumerable: true,
            get() {
                return vdom.state[index] ?? defaultValue;
            },
            set(v) {
                vdom.slotState(v, index);
            },
        });
        React._hooks.push(slot);

        return slot;
    }
    static useState(defaultValue = undefined) {
        const vdom = React._vdom;
        const hooks = React._hooks;
        const index = hooks.length;

        let value;
        if (!vdom.state || vdom.state.length < index) {
            value = defaultValue;
        } else {
            value = vdom.state[index];
        }
        const setter = (it) => {
            vdom.slotState(it, index);
        };
        const slot = { useState: true, defaultValue, value, setter, index };
        hooks.push(slot);
        return [value, setter];
    }
    static Component = class Component {
        constructor(props = {}) {
            this.props = props;
        }
        setState(s) {
            this.state = s;
        }
        render() {
            throw new Error('Component needs a "render" method.');
        }
    }
};

self.ReactDOM = class ReactDOM {
    static createRoot(rootNode) {
        function nodeFromElement(el) {
            const { vdom } = el;
            if (!vdom || vdom.type === "text") {
                return document.createTextNode(el);
            }
            if (vdom.type === "native") {
                const node = document.createElement(el.tag);
                for (const [key, value] of Object.entries(el.props ?? {})) {
                    if (/^on/.test(key)) {
                        const evt = key.toLowerCase().slice(2);
                        node.addEventListener(evt, function (e) {
                            // console.log(evt, e, this);
                            value(e);
                        });
                    } else {
                        node[key] = value;
                    }
                }
                return node;
            }
            const customNode = nodeFromElement(vdom.subtree);
            rec(customNode, vdom.subtree.children)
            return customNode;
        }

        function rec(parentNode, children) {
            if (!children) {
                return;
            }
            for (const child of children) {
                const childNode = nodeFromElement(child);
                parentNode.appendChild(childNode);
                rec(childNode, child?.children);
            }
        }

        const root = {
            _rootNode: rootNode,
            _el: null,
            render(el) {
                root._el = el;
                root._rootNode.innerHTML = "";
                const node = nodeFromElement(el);
                rec(node, el.children);
                rootNode.appendChild(node);
            },
        };
        
        React._pulseListeners.push(() => {
            root.render(root._el);
        });

        return root;
    }
};
