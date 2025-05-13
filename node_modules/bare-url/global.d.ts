import * as url from '.'

type URLConstructor = typeof url.URL

declare global {
  type URL = url.URL

  const URL: URLConstructor
}
