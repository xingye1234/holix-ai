/**
 * 主题配置接口
 * 用于定义应用主题的颜色配置结构
 */

export interface ThemeConfig {
  /** 主题名称 */
  name: string
  /** 主题唯一标识符 */
  id: string
  /** 颜色配置 */
  colors: {
    /** 区域背景颜色 */
    regions: {
      /** 侧边栏背景 */
      sidebar: string
      /** 聊天区域背景 */
      chat: string
      /** 输入区域背景 */
      input: string
    }
    /** 消息气泡样式 */
    messages: {
      /** 用户消息样式 */
      user: {
        /** 背景颜色 */
        background: string
        /** 前景颜色（文字颜色） */
        foreground: string
        /** 阴影效果 */
        shadow: string
      }
      /** AI 消息样式 */
      ai: {
        /** 背景颜色 */
        background: string
        /** 前景颜色（文字颜色） */
        foreground: string
        /** 阴影效果 */
        shadow: string
        /** 边框颜色 */
        border: string
      }
      /** 消息状态颜色 */
      status: {
        /** 成功状态背景色 */
        success: string
        /** 错误状态背景色 */
        error: string
        /** 思考中状态背景色 */
        thinking: string
      }
    }
  }
}

/**
 * 自定义主题接口
 * 扩展自 ThemeConfig，添加自定义主题特有的属性
 */
export interface CustomTheme extends ThemeConfig {
  /** 标识为自定义主题 */
  isCustom: true
  /** 创建时间 */
  createdAt: Date
  /** 主题描述（可选） */
  description?: string
  /** 主题作者（可选） */
  author?: string
  /** 主题版本（可选） */
  version?: string
}

/**
 * 预设主题类型
 */
export type PresetTheme = 'light' | 'dark'

/**
 * 主题模式
 */
export type ThemeMode = 'light' | 'dark' | 'auto'

/**
 * 主题设置配置
 */
export interface ThemeSettings {
  /** 当前使用的主题模式 */
  mode: ThemeMode
  /** 当前使用的预设主题 */
  preset: PresetTheme
  /** 是否启用了自定义主题 */
  hasCustomTheme: boolean
  /** 自定义主题列表 */
  customThemes: CustomTheme[]
  /** 当前激活的自定义主题 ID（如果有） */
  activeCustomThemeId?: string
}

/**
 * 主题颜色变量映射
 * 用于将 CSS 变量映射到主题配置
 */
export interface ThemeVariableMapping {
  /** CSS 变量名 */
  variable: string
  /** 对应的主题配置路径 */
  path: string
  /** 默认值（亮色主题） */
  lightDefault: string
  /** 默认值（暗色主题） */
  darkDefault: string
}
