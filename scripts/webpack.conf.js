const path = require('path');
const cwd = process.cwd();
const TerserPlugin = require('terser-webpack-plugin');
module.exports = {
  entry: path.resolve(cwd, './src/index.ts'),
  externals : {
    react: 'React',
    'react-dom': 'ReactDOM'
  },
  mode: process.env.NODE_ENV || 'development',
  module: {
    rules: [
      { 
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: "tsconfig.json"
            }
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.less$/i,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
            options: {
              url: true,
              // class prefix
              modules: {
                localIdentName: process.env.COMP + '-[local]-[hash:base64:5]',
              }
            },
          },
          {
            loader: 'less-loader',
          },
        ],
      },
      {
        test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
        loader: 'url-loader',
        options: {
          esModule: false,
          limit: 100000,
        },
      },
    ]
  },
  output: {
    path: path.resolve(cwd, './dist'),
    libraryTarget: 'umd',
    filename: 'index.js',
    library: process.env.COMP,
  },
  resolve: {
    alias: {
      '@': path.resolve(cwd, './src')
    },
    extensions: [ ".ts", ".tsx", ".js"]
  },
  optimization: process.env.NODE_ENV === 'production' ? {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          mangle: {
            properties: {
              regex: /^_/ // 可选：仅压缩以 `_` 开头的私有方法名
            }
          }
        }
      })
    ]
  }: undefined,
  devServer: {
    open: ['/scripts/'],
    static: {
      directory: path.resolve(cwd),
    },
    hot: false,
    port: 12378
  }
};
