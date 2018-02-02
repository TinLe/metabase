/* eslint "react/prop-types": "warn" */
import React, { Component } from "react";
import PropTypes from "prop-types";
import { findDOMNode } from "react-dom";
import _ from "underscore";
import cx from "classnames";

import OnClickOutsideWrapper from 'metabase/components/OnClickOutsideWrapper';
import Icon from "metabase/components/Icon";
import Popover from "metabase/components/Popover";

import {
    KEYCODE_ESCAPE,
    KEYCODE_ENTER,
    KEYCODE_COMMA,
    KEYCODE_TAB,
    KEYCODE_UP,
    KEYCODE_DOWN,
    KEYCODE_BACKSPACE
} from "metabase/lib/keyboard";

// somewhat matches react-select's API: https://github.com/JedWatson/react-select
export default class TokenField extends Component {
    constructor(props) {
        super(props);

        this.state = {
            inputValue: "",
            filteredOptions: [],
            selectedOptionValue: null,
            focused: props.autoFocus
        };
    }

    static propTypes = {
        value: PropTypes.array,
        options: PropTypes.array,
        placeholder: PropTypes.string,
        autoFocus: PropTypes.bool,
        multi: PropTypes.bool,

        valueKey: PropTypes.string,
        labelKey: PropTypes.string,

        removeSelected: PropTypes.bool,
        filterOption: PropTypes.func,

        onChange: PropTypes.func.isRequired,
        onInputChange: PropTypes.func,
        onInputKeyDown: PropTypes.func,
        onAddFreeform: PropTypes.func,

        valueRenderer: PropTypes.func.isRequired, // TODO: default
        optionRenderer: PropTypes.func.isRequired, // TODO: default
        layoutRenderer: PropTypes.func,
    };

    static defaultProps = {
        removeSelected: true,
        layoutRenderer: (props) => <DefaultTokenFieldLayout {...props} />,
        valueKey: "value",
        labelKey: "label"
    };

    componentWillReceiveProps(nextProps, nextState) {
      setTimeout(this._updateFilteredValues, 0);
    }

    setInputValue(inputValue) {
        this.setState({
            inputValue
        }, this._updateFilteredValues);
    }

    filterOption(option, inputValue) {
      const { filterOption, labelKey } = this.props;
      if (filterOption) {
        return filterOption(option, inputValue);
      } else {
        return String(option[labelKey] || "").indexOf(inputValue) >= 0;
      }
    }

    _updateFilteredValues = () => {
      const { options, value, removeSelected, filterOption, valueKey } = this.props;
      let { inputValue, selectedOptionValue } = this.state;
      let selectedValues = new Set(value.map(v => JSON.stringify(v)));

      let filteredOptions = options.filter(option =>
          // filter out options who have already been selected
          (!removeSelected || !selectedValues.has(JSON.stringify(option[valueKey]))) &&
          this.filterOption(option, inputValue)
      );

      if (selectedOptionValue == null || !_.find(filteredOptions, (option) => this._valueIsEqual(selectedOptionValue, option[valueKey]))) {
          // if there are results based on the user's typing...
          if (filteredOptions.length > 0) {
              // select the first option in the list and set the selected option to that
              selectedOptionValue = filteredOptions[0][valueKey];
          } else {
              selectedOptionValue = null;
          }
      }

      this.setState({
          filteredOptions,
          selectedOptionValue
      });
    }

    onInputChange = ({ target: { value } }) => {
        if (this.props.onInputChange) {
          value = this.props.onInputChange(value) || "";
        }
        this.setInputValue(value);
    }

    // capture events on the input to allow for convenient keyboard shortcuts
    onInputKeyDown = (event) => {
        if (this.props.onInputKeyDown) {
          this.props.onInputKeyDown(event);
        }

        const keyCode = event.keyCode

        const { valueKey } = this.props;
        const { filteredOptions, selectedOptionValue } = this.state

        // enter, tab, comma
        if (keyCode === KEYCODE_ESCAPE || keyCode === KEYCODE_TAB || keyCode === KEYCODE_COMMA || keyCode === KEYCODE_ENTER) {
            this.addSelectedOption();
        }

        // up arrow
        else if (event.keyCode === KEYCODE_UP) {
            event.preventDefault();
            let index = _.findIndex(filteredOptions, (option) => this._valueIsEqual(selectedOptionValue, option[valueKey]));
            if (index > 0) {
                this.setState({ selectedOptionValue: filteredOptions[index - 1][valueKey] });
            }
        }

        // down arrow
        else if (keyCode === KEYCODE_DOWN) {
            event.preventDefault();
            let index = _.findIndex(filteredOptions, (option) => this._valueIsEqual(selectedOptionValue, option[valueKey]));
            if (index >= 0 && index < filteredOptions.length - 1) {
                this.setState({ selectedOptionValue: filteredOptions[index + 1][valueKey] });
            }
        }

        // backspace
        else if (keyCode === KEYCODE_BACKSPACE) {
            let { value } = this.props;
            if (!this.state.inputValue && value.length > 0) {
                this.removeValue(value[value.length - 1])
            }
        }
    }

    onInputFocus = () => {
        this.setState({ focused: true });
    }

    onInputBlur = () => {
        setTimeout(() => {
          this.setState({ inputValue: "", focused: false });
        }, 100)
    }

    onInputPaste = (e) => {
      if (this.props.onAddFreeform) {
        const string = e.clipboardData.getData('Text');
        const values = string.split(/\n|,/g).map(this.props.onAddFreeform).filter(s => s);
        if (values.length > 0) {
          this.addValue(values);
        }
      }
    }

    onMouseDownCapture = (e) => {
        let input = findDOMNode(this.refs.input);
        input.focus();
        // prevents clicks from blurring input while still allowing text selection:
        if (input !== e.target) {
            e.preventDefault();
        }
    }

    onClose = () => {
        this.setState({ focused: false });
    }

    addSelectedOption() {
        const { valueKey } = this.props
        const { selectedOptionValue } = this.state;
        let input = findDOMNode(this.refs.input);
        let option = _.find(this.state.filteredOptions, (option) => this._valueIsEqual(selectedOptionValue, option[valueKey]));
        if (option) {
            this.addOption(option);
        } else if (this.props.onAddFreeform) {
            const value = this.props.onAddFreeform(input.value);
            if (value) {
                this.addValue(value);
            }
        }
    }

    addOption = (option) => {
        const { valueKey } = this.props
        // add the option's value to the current value
        this.addValue(option[valueKey]);
    }

    addValue(valueToAdd) {
        const { value, onChange, multi } = this.props;
        if (!Array.isArray(valueToAdd)) {
          valueToAdd = [valueToAdd]
        }
        if (multi) {
            onChange(value.concat(valueToAdd));
        } else {
            onChange(valueToAdd.slice(0,1));
        }
        // reset the input value
        setTimeout(() =>
          this.setInputValue("")
        )
    }

    removeValue(valueToRemove) {
        const { value, onChange } = this.props
        const values = value.filter(v => !this._valueIsEqual(v, valueToRemove));
        onChange(values);
        // reset the input value
        this.setInputValue("");
    }

    _valueIsEqual(v1, v2) {
      return JSON.stringify(v1) === JSON.stringify(v2);
    }

    render() {
        let { value, placeholder, multi, valueKey, optionRenderer, valueRenderer, layoutRenderer } = this.props;
        let { inputValue, filteredOptions, focused, selectedOptionValue } = this.state;

        if (!multi && focused) {
            inputValue = inputValue || value[0];
            value = [];
        }

        const valuesList =
          <ul
              className={cx("m1 px1 pb1 bordered rounded flex flex-wrap bg-white", { "input--focus": this.state.focused })}
              onMouseDownCapture={this.onMouseDownCapture}
          >
              {value.map((v, index) =>
                  <li className="mr1 py1 pl1 mt1 rounded bg-purple text-white">
                      <span className="h4 text-bold">
                        {valueRenderer(v)}
                      </span>
                      <a
                          className="text-grey-2 text-white-hover px1"
                          onClick={() => this.removeValue(v)}
                      >
                          <Icon name="close" className="" size={12} />
                      </a>
                  </li>
              )}
              <li className="flex-full mr1 py1 pl1 mt1 bg-white" style={{ "minWidth": focused ? 100 : 0 }}>
                  <input
                      ref="input"
                      className="full h4 text-bold text-default no-focus borderless"
                      placeholder={placeholder}
                      value={inputValue}
                      autoFocus={focused}
                      onKeyDown={this.onInputKeyDown}
                      onChange={this.onInputChange}
                      onFocus={this.onInputFocus}
                      onBlur={this.onInputBlur}
                      onPaste={this.onInputPaste}
                  />
              </li>
          </ul>

        const optionsList = filteredOptions.length === 0 ? null :
            <ul className="ml1 scroll-y scroll-show" style={{ maxHeight: 300 }}>
                {filteredOptions.map(option =>
                    <li
                        className={cx(
                            "", {
                                //"bg-grey-1": this._valueIsEqual(selectedOptionValue, option[valueKey])
                        })}
                        onClick={() => this.addOption(option)}
                    >
                        <div className="py1 pl1 pr2 block rounded text-bold text-white-hover inline-block bg-purple-hover cursor-pointer">
                            {optionRenderer(option)}
                        </div>
                    </li>
                )}
            </ul>

        return layoutRenderer({ valuesList, optionsList, focused, onClose: this.onClose })
    }
}

const DefaultTokenFieldLayout = ({ valuesList, optionsList, focused, onClose }) =>
  <OnClickOutsideWrapper handleDismissal={onClose}>
    <div>
      {valuesList}
      <Popover
          isOpen={focused && !!optionsList}
          hasArrow={false}
          tetherOptions={{
              attachment: "top left",
              targetAttachment: "bottom left",
              targetOffset: "10 0"
          }}
      >
        {optionsList}
      </Popover>
    </div>
  </OnClickOutsideWrapper>

DefaultTokenFieldLayout.propTypes = {
  valuesList: PropTypes.element.isRequired,
  optionsList: PropTypes.element,
  focused: PropTypes.bool,
  onClose: PropTypes.func,
}
