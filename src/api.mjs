import assign from './assign.mjs'
import defaultConverter from './converter.mjs'

function init (converter, defaultAttributes) {
  function set (key, value, attributes) {
    /**
     * 当前是不是浏览器环境
     * typeof window === 'undefined' 一样
     */
    if (typeof document === 'undefined') {
      return
    }

    /**
     * 将多个对象的属性合并到一个对象上，后面对象直接覆盖前面对象属性
     * 作者为什么不用 Object.assign 呢
     */
    attributes = assign({}, defaultAttributes, attributes)

    /**
     * expires 设置了天时间，转换为毫秒，相对于当前时间向后延伸
     */
    if (typeof attributes.expires === 'number') {
      attributes.expires = new Date(Date.now() + attributes.expires * 864e5)
    }

    /**
     * https://developer.mozilla.org/zh-CN/docs/Web/API/Document/cookie
     * Cookie 约定 expires 属性时间格式为 UTC
     * 例: Mon, 03 Jul 2006 21:44:38 GMT
     */
    if (attributes.expires) {
      attributes.expires = attributes.expires.toUTCString()
    }

    /**
     * Cookie 的 key 特殊字符的转换处理
     * ; = 特殊字符进行转码
     * @type {string}
     */
    key = defaultConverter.write(key).replace(/=/g, '%3D')

    /**
     * value 值使用 converter 进行转码，为什么不使用 defaultConverter.write 呢?
     * 因为支持用户自定义转换器函数 read 和 write，converter 就可能是外部自定义的转换器
     */
    value = converter.write(value, key)

    /**
     * 处理设置 cookie 时的选项属性
     * 如：
     *    path、domain、secure等
     * 存储格式："someCookieName=true; expires=Fri, 31 Dec 9999 23:59:59 GMT; path=/"
     *
     * {
     *   path: '/user',
     *   expires: 'Mon, 03 Jul 2006 21:44:38 GMT'
     * }
     */
    var stringifiedAttributes = ''
    for (var attributeName in attributes) {
      if (!attributes[attributeName]) {
        continue
      }

      stringifiedAttributes += '; ' + attributeName

      /**
       * secure 安全协议（https）时携带 cookie
       */
      if (attributes[attributeName] === true) {
        continue
      }

      /**
       * 没有搞太明白为什么要 split(';')
       * 搞明白了, 测试用例的需要。在测试用例中涵盖了某些情况，比如:
       * https://github.com/js-cookie/js-cookie/blob/master/test/tests.js#L382
       */
      stringifiedAttributes += '=' + attributes[attributeName].split(';')[0]
    }

    /**
     * docCookies.setItem(name, value[, end[, path[, domain[, secure]]]])
     */
    return (document.cookie = key + '=' + value + stringifiedAttributes)
  }

  function get (key) {
    /**
     * Cookie.get('')
     */
    if (typeof document === 'undefined' || (arguments.length && !key)) {
      return
    }

    // To prevent the for loop in the first place assign an empty array
    // in case there are no cookies at all.
    /**
     * 当前 document 中所有的 cookie列表
     */
    var cookies = document.cookie ? document.cookie.split('; ') : []
    var jar = {}
    for (var i = 0; i < cookies.length; i++) {
      /**
       * name=value; a=1=2=3; x=001; y=002
       */
      var parts = cookies[i].split('=')
      /**
       * 1. value = value
       * 2. value = 1=2=3
       * 3. value = 001
       * 4. value = 002
       */
      var value = parts.slice(1).join('=')
      /**
       * 将存储的 key 再还原为原始的 key（如果存在需要编码的情况下）
       */
      var foundKey = defaultConverter.read(parts[0]).replace(/%3D/g, '=')
      /**
       * 如果 value 值需要解码
       */
      jar[foundKey] = converter.read(value, foundKey)

      /**
       * 提前结束循环
       */
      if (key === foundKey) {
        break
      }
    }

    return key ? jar[key] : jar
  }

  return Object.create(
    {
      set: set,
      get: get,
      remove: function (key, attributes) {
        set(
          key,
          '',
          assign({}, attributes, {
            expires: -1
          })
        )
      },
      withAttributes: function (attributes) {
        return init(this.converter, assign({}, this.attributes, attributes))
      },
      withConverter: function (converter) {
        return init(assign({}, this.converter, converter), this.attributes)
      }
    },
    {
      attributes: { value: Object.freeze(defaultAttributes) },
      converter: { value: Object.freeze(converter) }
    }
  )
}

export default init(defaultConverter, { path: '/' })
